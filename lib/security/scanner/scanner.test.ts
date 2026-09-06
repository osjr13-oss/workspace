import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { runStaticHtmlScan, runUrlScan } from "./index";
import { normalizeScanUrl, resolvePublicAddresses } from "./url";

// Define mock state variables
let dnsMockData = { spf: false, dmarc: false };
let robotsMockData = { exists: false };
let securityMockData = { exists: false };
let sslMockData = {
  validTo: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toUTCString(),
};
let pageMockData = {
  html: "",
  headers: {} as Record<string, string>,
};

// Mock the tls module
vi.mock("tls", () => {
  return {
    default: {
      connect: vi.fn((options, callback) => {
        const socket = {
          getPeerCertificate: () => ({
            valid_to: sslMockData.validTo,
          }),
          destroy: vi.fn(),
          on: vi.fn().mockReturnThis(),
          setTimeout: vi.fn().mockReturnThis(),
        };
        process.nextTick(() => {
          if (callback) callback();
        });
        return socket;
      }),
    },
  };
});

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (hostname: string) => {
    if (hostname === "private.test") {
      return [{ address: "127.0.0.1", family: 4 }];
    }
    return [{ address: "93.184.216.34", family: 4 }];
  }),
}));

// Mock fetch handler
const mockFetch = vi.fn((url: string | URL, init?: any) => {
  const urlString = typeof url === "string" ? url : url.toString();

  // Cloudflare DNS over HTTPS TXT query
  if (urlString.startsWith("https://cloudflare-dns.com/dns-query")) {
    const parsed = new URL(urlString);
    const name = parsed.searchParams.get("name") || "";
    if (name === "example.com") {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            Answer: dnsMockData.spf
              ? [{ data: '"v=spf1 include:_spf.google.com ~all"' }]
              : [],
          }),
      } as Response);
    }
    if (name === "_dmarc.example.com") {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            Answer: dnsMockData.dmarc ? [{ data: '"v=DMARC1; p=reject"' }] : [],
          }),
      } as Response);
    }
  }

  // robots.txt
  if (urlString.endsWith("/robots.txt")) {
    return Promise.resolve({
      status: robotsMockData.exists ? 200 : 404,
      ok: robotsMockData.exists,
      text: () =>
        Promise.resolve(
          robotsMockData.exists ? "User-agent: *\nDisallow:" : "Not found",
        ),
    } as Response);
  }

  // security.txt
  if (urlString.endsWith("/.well-known/security.txt")) {
    return Promise.resolve({
      status: securityMockData.exists ? 200 : 404,
      ok: securityMockData.exists,
      text: () =>
        Promise.resolve(
          securityMockData.exists
            ? "Contact: security@example.com"
            : "Not found",
        ),
    } as Response);
  }

  // Primary page
  if (
    urlString === "https://example.com" ||
    urlString === "https://example.com/"
  ) {
    const headers: Record<string, string> = {
      "content-type": "text/html",
      ...pageMockData.headers,
    };
    return Promise.resolve({
      url: "https://example.com/",
      status: 200,
      ok: true,
      headers: {
        get: (h: string) => headers[h.toLowerCase()] || null,
        forEach: (cb: any) => {
          Object.entries(headers).forEach(([k, v]) => cb(v, k));
        },
      },
      text: () => Promise.resolve(pageMockData.html),
    } as unknown as Response);
  }

  // Subpages (e.g. /about, /pricing, /privacy, /terms, /contact)
  if (urlString.startsWith("https://example.com/")) {
    const headers: Record<string, string> = {
      "content-type": "text/html",
      ...pageMockData.headers,
    };
    return Promise.resolve({
      url: urlString,
      status: 200,
      ok: true,
      headers: {
        get: (h: string) => headers[h.toLowerCase()] || null,
        forEach: (cb: any) => {
          Object.entries(headers).forEach(([k, v]) => cb(v, k));
        },
      },
      text: () =>
        Promise.resolve(`
          <html>
            <head>
              <title>Subpage</title>
              <meta name="description" content="A serious subpage of the website." />
              <link rel="canonical" href="${urlString}" />
            </head>
            <body>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="/contact">Contact</a>
            </body>
          </html>
        `),
    } as unknown as Response);
  }

  return Promise.reject(new Error(`Unhandled mock fetch URL: ${urlString}`));
});

describe("normalizeScanUrl", () => {
  it("defaults bare domains to https", () => {
    expect(normalizeScanUrl("example.com").toString()).toBe(
      "https://example.com/",
    );
  });

  it("rejects non-http protocols", () => {
    expect(() => normalizeScanUrl("file:///etc/passwd")).toThrow(
      /HTTP and HTTPS/,
    );
  });

  it("rejects URLs containing credentials", () => {
    expect(() => normalizeScanUrl("https://user:password@example.com")).toThrow(
      /credentials/,
    );
  });

  it("rejects non-standard web ports", () => {
    expect(() => normalizeScanUrl("https://example.com:8443")).toThrow(
      /standard public web ports/,
    );
  });

  it("rejects hostnames that resolve to private addresses", async () => {
    await expect(resolvePublicAddresses("private.test")).rejects.toThrow(
      /public websites/,
    );
  });
});

describe("runStaticHtmlScan", () => {
  it("flags high-value launch issues", () => {
    const result = runStaticHtmlScan(
      "https://example.com",
      `
        <html>
          <head>
            <title>Example</title>
            <script src="https://cdn.example.net/app.js"></script>
            <script>window.OPENAI_API_KEY = "not-a-real-secret-key";</script>
          </head>
          <body>
            <form action="http://forms.example.net/login">
              <input type="password" />
            </form>
            <a href="https://bit.ly/not-clear">Claim</a>
          </body>
        </html>
      `,
      {
        "content-type": "text/html",
      },
    );

    expect(result.score).toBeLessThan(70);
    expect(
      result.findings.some(
        (finding) => finding.title === "Content Security Policy is missing",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.title === "Form submits to an insecure endpoint",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) =>
          finding.title === "Environment-like values are exposed in the page",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) =>
          finding.title === "Suspicious external destination is linked",
      ),
    ).toBe(true);
  });

  it("does not flag intentionally public frontend configuration as a secret leak", () => {
    const result = runStaticHtmlScan(
      "https://example.com",
      `<script>window.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-browser-key";</script>`,
      {},
    );

    expect(
      result.findings.some(
        (finding) =>
          finding.title === "Environment-like values are exposed in the page",
      ),
    ).toBe(false);
  });

  it("does not label an image-only CSP wildcard as broad script execution", () => {
    const result = runStaticHtmlScan(
      "https://example.com",
      "<html><head><title>Example</title></head></html>",
      {
        "content-security-policy":
          "default-src 'self'; script-src 'self'; img-src *",
      },
    );

    expect(
      result.findings.some(
        (finding) =>
          finding.title === "Content Security Policy allows broad execution",
      ),
    ).toBe(false);
  });

  it("keeps a hardened page high scoring", () => {
    const result = runStaticHtmlScan(
      "https://example.com",
      `
        <html>
          <head>
            <title>Example</title>
            <meta name="description" content="A serious production website." />
            <link rel="canonical" href="https://example.com/" />
          </head>
          <body>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
          </body>
        </html>
      `,
      {
        "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=(), microphone=(), geolocation=()",
        "x-content-type-options": "nosniff",
      },
    );

    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.findings).toHaveLength(0);
  });
});

describe("runUrlScan", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    dnsMockData = { spf: false, dmarc: false };
    robotsMockData = { exists: false };
    securityMockData = { exists: false };
    sslMockData = {
      validTo: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toUTCString(),
    };
    pageMockData = {
      html: `
        <html>
          <head>
            <title>Example Page</title>
          </head>
          <body>
            <a href="/about">About</a>
            <a href="/pricing">Pricing</a>
            <a href="https://external.com">External</a>
          </body>
        </html>
      `,
      headers: {},
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("identifies missing DNS, SSL, robots.txt, security.txt, and crawls pages", async () => {
    const result = await runUrlScan("https://example.com");

    expect(result.status).toBe("completed");
    expect(result.url).toBe("https://example.com/");

    const titles = result.findings.map((f) => f.title);
    expect(titles).toContain("Email SPF record is missing");
    expect(titles).toContain("Email DMARC policy is missing");
    expect(titles).toContain("SSL/TLS certificate is expiring soon");
    expect(titles).toContain("robots.txt file is missing");
    expect(titles).toContain("security.txt file is missing");

    expect(result.score).toBeLessThan(50);
  });

  it("passes cleanly with a hardened setup, valid DNS, SSL, robots/security files", async () => {
    dnsMockData = { spf: true, dmarc: true };
    robotsMockData = { exists: true };
    securityMockData = { exists: true };
    sslMockData = {
      validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString(),
    };
    pageMockData = {
      html: `
        <html>
          <head>
            <title>Secured Page</title>
            <meta name="description" content="Very secure website." />
            <link rel="canonical" href="https://example.com/" />
          </head>
          <body>
            <a href="/about">About</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
            <a href="/contact">Contact Us</a>
          </body>
        </html>
      `,
      headers: {
        "content-security-policy": "default-src 'self'",
        "strict-transport-security": "max-age=31536000",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "geolocation=()",
        "x-content-type-options": "nosniff",
      },
    };

    const result = await runUrlScan("https://example.com");

    expect(result.score).toBeGreaterThanOrEqual(95);

    const titles = result.findings.map((f) => f.title);
    expect(titles).not.toContain("Email SPF record is missing");
    expect(titles).not.toContain("Email DMARC policy is missing");
    expect(titles).not.toContain("SSL/TLS certificate is expiring soon");
    expect(titles).not.toContain("robots.txt file is missing");
    expect(titles).not.toContain("security.txt file is missing");
  });

  it("merges duplicate findings across crawled subpages", async () => {
    dnsMockData = { spf: true, dmarc: true };
    robotsMockData = { exists: true };
    securityMockData = { exists: true };
    sslMockData = {
      validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString(),
    };
    pageMockData = {
      html: `
        <html>
          <head>
            <title>Page title</title>
            <meta name="description" content="Desc" />
            <link rel="canonical" href="https://example.com/" />
          </head>
          <body>
            <a href="/about">About</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
          </body>
        </html>
      `,
      headers: {
        "strict-transport-security": "max-age=31536000",
      },
    };

    const result = await runUrlScan("https://example.com");

    const cspFinding = result.findings.find(
      (f) => f.title === "Content Security Policy is missing",
    );
    expect(cspFinding).toBeDefined();

    expect(cspFinding!.evidence).toContain("Affected paths:");
    expect(cspFinding!.evidence).toContain("/");
    expect(cspFinding!.evidence).toContain("/about");
  });
});
