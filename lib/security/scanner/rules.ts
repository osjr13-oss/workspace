import type {
  Finding,
  FindingCategory,
  PassiveScanInput,
  Severity,
} from "./types";
import { getRegistrableHost, isSameHost } from "./url";

const SECURITY_HEADER_REFERENCES = [
  "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy",
  "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security",
];

type HtmlInventory = {
  title?: string;
  canonical?: string;
  metaDescription?: string;
  forms: Array<{ action?: string; hasPassword: boolean }>;
  scripts: string[];
  links: string[];
  mixedContent: string[];
  trustSignals: string[];
  envLeaks: string[];
  sourceMapSignals: string[];
};

let findingSequence = 0;

export function createFinding(
  category: FindingCategory,
  severity: Severity,
  title: string,
  evidence: string,
  remediation: string,
  affectedUrl: string,
  references?: string[],
): Finding {
  findingSequence += 1;
  return {
    id: `finding_${findingSequence.toString().padStart(3, "0")}`,
    category,
    severity,
    title,
    evidence,
    remediation,
    affectedUrl,
    references,
  };
}

export function createSpfMissingFinding(domain: string): Finding {
  return createFinding(
    "trust_readiness",
    "low",
    "Email SPF record is missing",
    `No SPF (Sender Policy Framework) record was found in the DNS TXT records for ${domain}.`,
    "Add an SPF record to your domain's DNS TXT settings (e.g., v=spf1 include:_spf.google.com ~all) to authorize mail servers and prevent email spoofing.",
    `https://${domain}`,
  );
}

export function createDmarcMissingFinding(domain: string): Finding {
  return createFinding(
    "trust_readiness",
    "low",
    "Email DMARC policy is missing",
    `No DMARC policy record was found at _dmarc.${domain}.`,
    "Add a DMARC record to your DNS TXT settings at _dmarc (e.g., v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com) to instruct mail servers how to handle spoofed emails and improve your domain's deliverability.",
    `https://${domain}`,
  );
}

export function createSslExpirationFinding(
  domain: string,
  daysRemaining: number,
  expiryDateStr: string,
  severity: Severity,
): Finding {
  return createFinding(
    "transport",
    severity,
    daysRemaining <= 0
      ? "SSL/TLS certificate has expired"
      : `SSL/TLS certificate is expiring soon`,
    daysRemaining <= 0
      ? `The SSL/TLS certificate for ${domain} expired on ${expiryDateStr}.`
      : `The SSL/TLS certificate for ${domain} expires in ${daysRemaining} days (on ${expiryDateStr}).`,
    "Renew the SSL/TLS certificate immediately via your hosting provider or certificate authority (like Let's Encrypt) to avoid security warnings in visitor browsers.",
    `https://${domain}`,
  );
}

export function createRobotsMissingFinding(domain: string): Finding {
  return createFinding(
    "trust_readiness",
    "low",
    "robots.txt file is missing",
    "No robots.txt file was found at the root of the website.",
    "Use robots.txt to express crawler preferences. It does not enforce access control; protect private routes with authentication.",
    `https://${domain}/robots.txt`,
  );
}

export function createSecurityTxtMissingFinding(domain: string): Finding {
  return createFinding(
    "trust_readiness",
    "low",
    "security.txt file is missing",
    "No security.txt file was found under the standard /.well-known/ directory.",
    "Add a security.txt file in your public /.well-known/ directory (following securitytxt.org specifications) so security researchers can easily find your contact details and report vulnerabilities responsibly.",
    `https://${domain}/.well-known/security.txt`,
  );
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Boolean(headers[name.toLowerCase()]);
}

function getHeader(headers: Record<string, string>, name: string): string {
  return headers[name.toLowerCase()] ?? "";
}

function extractAttribute(tag: string, attribute: string): string | undefined {
  const expression = new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, "i");
  return tag.match(expression)?.[1];
}

function absoluteUrl(
  value: string | undefined,
  base: string,
): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, base).toString();
  } catch {
    return undefined;
  }
}

export function inventoryHtml(html: string, baseUrl: string): HtmlInventory {
  const title = html
    .match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    ?.trim()
    .replace(/\s+/g, " ");
  const metaDescription = html
    .match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0]
    ?.match(/content\s*=\s*["']([^"']+)["']/i)?.[1]
    ?.trim();
  const canonical = html
    .match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0]
    ?.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];

  const forms = [...html.matchAll(/<form\b[^>]*>/gi)].map((match) => {
    const tag = match[0];
    const end = html.indexOf("</form>", match.index ?? 0);
    const formHtml = end >= 0 ? html.slice(match.index, end) : tag;
    return {
      action: absoluteUrl(extractAttribute(tag, "action"), baseUrl),
      hasPassword: /<input[^>]+type=["']password["']/i.test(formHtml),
    };
  });

  const scripts = [
    ...html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi),
  ]
    .map((match) => absoluteUrl(match[1], baseUrl))
    .filter((value): value is string => Boolean(value));

  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => absoluteUrl(match[1], baseUrl))
    .filter((value): value is string => Boolean(value));

  const mixedContent = [
    ...html.matchAll(/\b(?:src|href)=["'](http:\/\/[^"']+)["']/gi),
  ].map((match) => match[1]);
  const sourceMapSignals = [...html.matchAll(/sourceMappingURL=/gi)].map(
    (match) => match[0],
  );
  const envLeaks = [
    ...html.matchAll(
      /\b(?:SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|OPENAI_API_KEY|GROQ_API_KEY|AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN)\s*[:=]\s*["'][^"']{8,}["']/gi,
    ),
  ].map((match) => `${match[0].split(/[:=]/)[0].trim()} = [REDACTED]`);

  const trustSignals = links.filter((link) =>
    /privacy|terms|contact|support|security|status/i.test(link),
  );

  return {
    title,
    canonical,
    metaDescription,
    forms,
    scripts,
    links,
    mixedContent,
    trustSignals,
    envLeaks,
    sourceMapSignals,
  };
}

export function runPassiveRules(input: PassiveScanInput): {
  findings: Finding[];
  inventory: HtmlInventory;
} {
  findingSequence = 0;

  const findings: Finding[] = [];
  const inventory = inventoryHtml(input.html, input.finalUrl);
  const finalUrl = new URL(input.finalUrl);
  const isHttps = finalUrl.protocol === "https:";
  const host = getRegistrableHost(input.finalUrl);
  const csp = getHeader(input.headers, "content-security-policy");
  const hsts = getHeader(input.headers, "strict-transport-security");

  if (!isHttps) {
    findings.push(
      createFinding(
        "transport",
        "high",
        "Site is not served over HTTPS",
        `${input.finalUrl} resolved over HTTP.`,
        "Serve the production site over HTTPS and redirect all HTTP traffic to HTTPS before launch.",
        input.finalUrl,
      ),
    );
  }

  const hasForms = inventory.forms.length > 0;
  const hasPasswordForms = inventory.forms.some((f) => f.hasPassword);

  if (isHttps && !hsts) {
    const severity: Severity = hasPasswordForms ? "medium" : "low";
    findings.push(
      createFinding(
        "security_headers",
        severity,
        "Strict-Transport-Security is missing",
        "The response did not include the Strict-Transport-Security header.",
        hasPasswordForms
          ? "Add HSTS with a long max-age to protect sensitive user login requests against SSL stripping attacks."
          : "Add HSTS (Strict-Transport-Security) header to enforce secure connections for your visitors.",
        input.finalUrl,
        SECURITY_HEADER_REFERENCES,
      ),
    );
  }

  if (!csp) {
    const severity: Severity = hasPasswordForms
      ? "high"
      : hasForms
        ? "medium"
        : "low";
    findings.push(
      createFinding(
        "security_headers",
        severity,
        "Content Security Policy is missing",
        "No Content-Security-Policy header was observed on the primary page response.",
        hasPasswordForms
          ? "Add a Content Security Policy to protect user login and password inputs from Cross-Site Scripting (XSS) attacks."
          : "Add a Content Security Policy to restrict scripts, styles, and connections to known trusted origins.",
        input.finalUrl,
        SECURITY_HEADER_REFERENCES,
      ),
    );
  } else if (
    /(?:^|;)\s*(?:script-src|script-src-elem|script-src-attr|default-src)\s+[^;]*(?:'unsafe-inline'|'unsafe-eval'|\*)/i.test(
      csp,
    )
  ) {
    findings.push(
      createFinding(
        "security_headers",
        "low",
        "Content Security Policy allows broad execution",
        `Observed CSP contains broad directives: ${csp.slice(0, 160)}`,
        "Tighten the CSP by replacing wildcards or unsafe-inline allowances with nonces, hashes, or specific trusted origins.",
        input.finalUrl,
        SECURITY_HEADER_REFERENCES,
      ),
    );
  }

  if (
    !hasHeader(input.headers, "x-frame-options") &&
    !/frame-ancestors/i.test(csp)
  ) {
    const severity: Severity = hasPasswordForms ? "medium" : "low";
    findings.push(
      createFinding(
        "security_headers",
        severity,
        "Clickjacking protection is not explicit",
        "No X-Frame-Options header or CSP frame-ancestors directive was observed.",
        hasPasswordForms
          ? "Deny framing completely or restrict it to trusted origins (frame-ancestors) to prevent attackers from overlaying transparent clickjacking frames over login fields."
          : "Define X-Frame-Options or frame-ancestors to prevent other sites from embedding your page in an iframe.",
        input.finalUrl,
      ),
    );
  }

  if (!hasHeader(input.headers, "referrer-policy")) {
    const severity: Severity = hasForms ? "low" : "info";
    findings.push(
      createFinding(
        "security_headers",
        severity,
        "Referrer-Policy is missing",
        "The response did not define how much URL context is sent to external sites.",
        "Add a Referrer-Policy such as strict-origin-when-cross-origin for a safer production default.",
        input.finalUrl,
      ),
    );
  }

  if (!hasHeader(input.headers, "permissions-policy")) {
    findings.push(
      createFinding(
        "security_headers",
        "info",
        "Permissions-Policy is missing",
        "No Permissions-Policy header was observed.",
        "Add a Permissions-Policy that disables browser capabilities the site does not need, such as camera or geolocation.",
        input.finalUrl,
      ),
    );
  }

  if (!hasHeader(input.headers, "x-content-type-options")) {
    const severity: Severity = hasForms ? "low" : "info";
    findings.push(
      createFinding(
        "security_headers",
        severity,
        "MIME sniffing protection is missing",
        "The response did not include X-Content-Type-Options.",
        "Add X-Content-Type-Options: nosniff to reduce browser content-type confusion.",
        input.finalUrl,
      ),
    );
  }

  const cookiesMissingSecure: string[] = [];
  const cookiesMissingSameSite: string[] = [];

  input.setCookieHeaders.forEach((cookie) => {
    const name = cookie.split("=")[0]?.trim() || "unknown";

    if (!/;\s*secure/i.test(cookie) && isHttps) {
      cookiesMissingSecure.push(name);
    }

    if (!/;\s*httponly/i.test(cookie) && /session|auth|token|sid/i.test(name)) {
      findings.push(
        createFinding(
          "cookies_forms",
          "medium",
          "Sensitive cookie is accessible to JavaScript",
          `${name} looks session-related and was set without HttpOnly.`,
          "Set HttpOnly on session or authentication cookies unless client-side JavaScript truly needs access.",
          input.finalUrl,
        ),
      );
    }

    if (!/;\s*samesite=/i.test(cookie)) {
      cookiesMissingSameSite.push(name);
    }
  });

  if (cookiesMissingSecure.length > 0) {
    const listed =
      cookiesMissingSecure.slice(0, 3).join(", ") +
      (cookiesMissingSecure.length > 3
        ? ` and ${cookiesMissingSecure.length - 3} more`
        : "");
    findings.push(
      createFinding(
        "cookies_forms",
        "medium",
        "Cookies are missing the Secure attribute",
        `${cookiesMissingSecure.length} cookie${cookiesMissingSecure.length > 1 ? "s are" : " is"} set without the Secure flag: ${listed}.`,
        "Set Secure on production cookies so browsers only send them over HTTPS.",
        input.finalUrl,
      ),
    );
  }

  if (cookiesMissingSameSite.length > 0) {
    const listed =
      cookiesMissingSameSite.slice(0, 3).join(", ") +
      (cookiesMissingSameSite.length > 3
        ? ` and ${cookiesMissingSameSite.length - 3} more`
        : "");
    findings.push(
      createFinding(
        "cookies_forms",
        "low",
        "Cookies are missing an explicit SameSite policy",
        `${cookiesMissingSameSite.length} cookie${cookiesMissingSameSite.length > 1 ? "s lack" : " lacks"} a SameSite attribute: ${listed}.`,
        "Set SameSite=Lax or SameSite=Strict for most first-party cookies to prevent cross-site request forgery.",
        input.finalUrl,
      ),
    );
  }

  inventory.forms.forEach((form) => {
    if (form.action && /^http:\/\//i.test(form.action)) {
      findings.push(
        createFinding(
          "cookies_forms",
          form.hasPassword ? "critical" : "high",
          "Form submits to an insecure endpoint",
          `A form action points to ${form.action}.`,
          "Route form submissions through HTTPS endpoints owned by the production application or a vetted provider.",
          form.action,
        ),
      );
    }

    if (form.action && !isSameHost(form.action, input.finalUrl)) {
      const isTrustedThirdParty =
        /stripe\.com|paypal\.com|hsforms\.com|list-manage\.com|convertkit\.com|typeform\.com|google\.com|auth0\.com|resend\.com/i.test(
          form.action,
        );
      const severity: Severity = isTrustedThirdParty ? "low" : "medium";
      findings.push(
        createFinding(
          "cookies_forms",
          severity,
          "Form submits to a third-party domain",
          `A form action points outside ${host}: ${form.action}.`,
          isTrustedThirdParty
            ? `This form submits to a trusted service (${new URL(form.action).hostname}). Ensure this integration is configured securely.`
            : "Confirm this provider is approved, disclose it where needed, and ensure submitted data is protected contractually and technically.",
          form.action,
        ),
      );
    }
  });

  if (isHttps && inventory.mixedContent.length > 0) {
    findings.push(
      createFinding(
        "transport",
        "medium",
        "Page references insecure assets",
        `Found ${inventory.mixedContent.length} HTTP asset reference(s), including ${inventory.mixedContent[0]}.`,
        "Serve all production assets over HTTPS and replace hardcoded HTTP asset URLs.",
        input.finalUrl,
      ),
    );
  }

  if (inventory.sourceMapSignals.length > 0) {
    findings.push(
      createFinding(
        "frontend_exposure",
        "low",
        "Source map references are visible",
        `Observed source map signal: ${inventory.sourceMapSignals[0]}.`,
        "Avoid publishing production source maps publicly unless they are intentionally protected and reviewed for sensitive code paths.",
        input.finalUrl,
      ),
    );
  }

  if (inventory.envLeaks.length > 0) {
    findings.push(
      createFinding(
        "frontend_exposure",
        "high",
        "Environment-like values are exposed in the page",
        `Observed client-exposed key pattern: ${inventory.envLeaks[0]}.`,
        "Review the exposed value, rotate it if sensitive, and move private credentials to server-only environment variables.",
        input.finalUrl,
      ),
    );
  }

  const thirdPartyScripts = inventory.scripts.filter(
    (script) => !isSameHost(script, input.finalUrl),
  );
  const trackerScripts = thirdPartyScripts.filter((script) =>
    /google-analytics|googletagmanager|facebook|hotjar|fullstory|segment|clarity|intercom|hubspot/i.test(
      script,
    ),
  );

  if (trackerScripts.length >= 3) {
    findings.push(
      createFinding(
        "frontend_exposure",
        "low",
        "Multiple tracker scripts are present",
        `Observed ${trackerScripts.length} analytics or session tracking scripts.`,
        "Reduce tracking to approved tools, document each data processor, and make privacy disclosures match production behavior.",
        input.finalUrl,
      ),
    );
  }

  if (thirdPartyScripts.length > 12) {
    findings.push(
      createFinding(
        "frontend_exposure",
        "low",
        "Large third-party script surface",
        `Observed ${thirdPartyScripts.length} third-party script origins.`,
        "Review every third-party script for business need, ownership, data access, and incident response impact.",
        input.finalUrl,
      ),
    );
  }

  if (!inventory.metaDescription) {
    findings.push(
      createFinding(
        "trust_readiness",
        "low",
        "Meta description is missing",
        "No page-level meta description was observed.",
        "Add a clear meta description so shared links and search snippets communicate what the site is.",
        input.finalUrl,
      ),
    );
  }

  if (!inventory.canonical) {
    findings.push(
      createFinding(
        "trust_readiness",
        "low",
        "Canonical URL is missing",
        "No canonical link was observed on the page.",
        "Add a canonical URL to reduce duplicate indexing and make the launch domain explicit.",
        input.finalUrl,
      ),
    );
  }

  const hasPrivacy =
    inventory.trustSignals.some((link) => /privacy/i.test(link)) ||
    /privacy\s*policy|privacy\s*notice/i.test(input.html);
  const hasTerms =
    inventory.trustSignals.some((link) => /terms/i.test(link)) ||
    /conditions\s*of\s*use|terms\s*of\s*service|terms\s*of\s*use|terms\s*&amp;\s*conditions|user\s*agreement/i.test(
      input.html,
    );
  const hasContact =
    inventory.trustSignals.some((link) => /contact|support/i.test(link)) ||
    /contact\s*us|help\s*cent(?:er|re)|customer\s*service/i.test(input.html);

  if (!hasPrivacy || !hasTerms || !hasContact) {
    const missing = [
      !hasPrivacy ? "privacy" : null,
      !hasTerms ? "terms" : null,
      !hasContact ? "contact/support" : null,
    ]
      .filter(Boolean)
      .join(", ");

    findings.push(
      createFinding(
        "trust_readiness",
        "low",
        "Key trust links are missing",
        `Missing visible trust destination(s): ${missing}.`,
        "Add visible privacy, terms, and contact or support destinations before sending launch traffic.",
        input.finalUrl,
      ),
    );
  }

  const suspiciousDestinations = inventory.links.filter((link) =>
    /bit\.ly|tinyurl|t\.me|telegram|discord\.gg|freegift|airdrop/i.test(link),
  );

  if (suspiciousDestinations.length > 0) {
    findings.push(
      createFinding(
        "trust_readiness",
        "medium",
        "Suspicious external destination is linked",
        `Observed external destination: ${suspiciousDestinations[0]}.`,
        "Replace opaque or high-risk external links with owned, clearly branded, and documented destinations.",
        suspiciousDestinations[0],
      ),
    );
  }

  return { findings, inventory };
}

export function scoreFindings(findings: Finding[]): number {
  const penaltyBySeverity: Record<Severity, number> = {
    critical: 25,
    high: 15,
    medium: 8,
    low: 3,
    info: 0,
  };

  return Math.max(
    0,
    100 -
      findings.reduce(
        (score, finding) => score + penaltyBySeverity[finding.severity],
        0,
      ),
  );
}

export function summarizeFindings(findings: Finding[], score: number): string {
  const critical = findings.filter(
    (finding) => finding.severity === "critical",
  ).length;
  const high = findings.filter((finding) => finding.severity === "high").length;
  const medium = findings.filter(
    (finding) => finding.severity === "medium",
  ).length;

  if (critical > 0) {
    return `Review ${critical} critical finding${critical === 1 ? "" : "s"} and verify the suggested fixes.`;
  }

  if (high > 0) {
    return `Review ${high} high-severity finding${high === 1 ? "" : "s"} first.`;
  }

  if (medium > 0) {
    return `Review ${medium} medium-priority finding${medium === 1 ? "" : "s"} in the public pages checked.`;
  }

  if (score >= 90) {
    return "No major observable launch-readiness issues were found in this passive scan.";
  }

  return "Only lower-priority launch-readiness issues were found.";
}
