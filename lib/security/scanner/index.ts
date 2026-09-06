import { randomUUID } from "crypto";
import tls from "tls";
import { withAnalysis } from "../analysis";
import type { ScanResult, Finding } from "./types";
import {
  runPassiveRules,
  scoreFindings,
  summarizeFindings,
  createSpfMissingFinding,
  createDmarcMissingFinding,
  createSslExpirationFinding,
  createRobotsMissingFinding,
  createSecurityTxtMissingFinding,
} from "./rules";
import {
  fetchPublicUrl,
  getRegistrableHost,
  normalizeScanUrl,
  readTextResponse,
  resolvePublicAddresses,
} from "./url";

function headersToRecord(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key.toLowerCase()] = value;
  });
  return output;
}

function extractSetCookie(headers: Headers): string[] {
  const maybeGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof maybeGetSetCookie.getSetCookie === "function") {
    return maybeGetSetCookie.getSetCookie();
  }

  const combined = headers.get("set-cookie");
  return combined ? [combined] : [];
}

async function getTxtRecords(domain: string): Promise<string[] | null> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT`,
      {
        headers: {
          Accept: "application/dns-json",
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (json.Status && json.Status !== 3) return null;
    if (!json.Answer || !Array.isArray(json.Answer)) return [];
    return json.Answer.map((ans: { data?: string }) => {
      const data = ans.data || "";
      return data.replace(/^"|"$/g, "");
    });
  } catch {
    return null;
  }
}

async function checkSslCertificate(
  domain: string,
): Promise<{ daysRemaining: number; expiryDate: string } | null> {
  const [address] = await resolvePublicAddresses(domain);

  return new Promise((resolve) => {
    try {
      const socket = tls.connect(
        {
          host: address,
          port: 443,
          servername: domain,
          rejectUnauthorized: false,
        },
        () => {
          const cert = socket.getPeerCertificate();
          socket.destroy();

          if (!cert || !cert.valid_to) {
            resolve(null);
            return;
          }

          const expiryMs = Date.parse(cert.valid_to);
          const daysRemaining = Math.ceil(
            (expiryMs - Date.now()) / (1000 * 60 * 60 * 24),
          );
          resolve({
            daysRemaining,
            expiryDate: new Date(expiryMs).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
          });
        },
      );

      socket.on("error", () => {
        resolve(null);
      });

      socket.setTimeout(3000, () => {
        socket.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

export async function runUrlScan(rawUrl: string): Promise<ScanResult> {
  const startedAt = new Date().toISOString();
  const normalized = normalizeScanUrl(rawUrl);
  const requestedUrl = normalized.toString();
  const warnings: string[] = [];
  let crawledPagesCount = 1;

  // 1. Visit the primary URL first with an optimized timeout of 8 seconds
  let primaryResponse: Response;
  let finalUrlObject: URL;
  try {
    const primary = await fetchPublicUrl(normalized, {
      headers: {
        "user-agent": "Selrano passive scanner",
      },
      signal: AbortSignal.timeout(8000),
    });
    primaryResponse = primary.response;
    finalUrlObject = primary.finalUrl;
  } catch (err) {
    throw new Error(
      `Could not connect to ${rawUrl}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!primaryResponse.ok) {
    await primaryResponse.body?.cancel();
    throw new Error(
      `Website returned HTTP ${primaryResponse.status}. Check that it is publicly accessible.`,
    );
  }
  const finalUrl = finalUrlObject.toString();
  const targetHost = getRegistrableHost(finalUrl);
  const targetHostname = finalUrlObject.hostname;
  const origin = finalUrlObject.origin;
  const primaryContentType = primaryResponse.headers.get("content-type") ?? "";
  if (!primaryContentType.includes("text/html")) {
    await primaryResponse.body?.cancel();
    throw new Error("Enter a public HTML page to scan.");
  }
  const primaryHtml = await readTextResponse(primaryResponse);
  const primaryHeaders = headersToRecord(primaryResponse.headers);
  const fetchedAt = new Date().toISOString();

  // Run passive rules on the primary page to extract initial findings and links
  const { findings: primaryFindings, inventory: primaryInventory } =
    runPassiveRules({
      requestedUrl: normalized.toString(),
      finalUrl,
      statusCode: primaryResponse.status,
      headers: primaryHeaders,
      html: primaryHtml,
      setCookieHeaders: extractSetCookie(primaryResponse.headers),
      fetchedAt,
    });

  // Extract internal URLs to crawl from the primary links
  const internalUrlsToCrawl: string[] = [];
  const visitedUrls = new Set<string>([requestedUrl, finalUrl]);

  const links = primaryInventory.links || [];
  for (const link of links) {
    try {
      const parsedLink = new URL(link);
      if (parsedLink.origin === origin) {
        if (
          parsedLink.protocol === "http:" ||
          parsedLink.protocol === "https:"
        ) {
          parsedLink.hash = "";
          const normalizedLink = parsedLink.toString();

          const isFile =
            /\.(png|jpg|jpeg|gif|svg|pdf|zip|gz|css|js|map|json|txt|xml)$/i.test(
              parsedLink.pathname,
            );

          if (!visitedUrls.has(normalizedLink) && !isFile) {
            internalUrlsToCrawl.push(normalizedLink);
            visitedUrls.add(normalizedLink);

            // Limit queue size to 9 additional subpages (10 pages total)
            if (internalUrlsToCrawl.length >= 9) {
              break;
            }
          }
        }
      }
    } catch {
      // Ignore invalid URLs
    }
  }

  // 2. Fetch and scan subpages concurrently alongside DNS, SSL, and robots/security files checks
  const crawlSubpagesPromise = (async (): Promise<Finding[][]> => {
    return Promise.all(
      internalUrlsToCrawl.map(async (subpageUrl) => {
        try {
          const subpage = await fetchPublicUrl(subpageUrl, {
            headers: {
              "user-agent": "Selrano passive crawler",
            },
            signal: AbortSignal.timeout(4000),
          });
          const subpageRes = subpage.response;
          if (!subpageRes.ok || subpage.finalUrl.origin !== origin) {
            await subpageRes.body?.cancel();
            warnings.push(
              "A linked page could not be checked within the target origin.",
            );
            return [];
          }
          const contentType = subpageRes.headers.get("content-type") ?? "";
          if (!contentType.includes("text/html")) {
            await subpageRes.body?.cancel();
            return [];
          }
          const html = await readTextResponse(subpageRes);
          crawledPagesCount += 1;
          const headers = headersToRecord(subpageRes.headers);

          const { findings } = runPassiveRules({
            requestedUrl: subpageUrl,
            finalUrl: subpage.finalUrl.toString(),
            statusCode: subpageRes.status,
            headers,
            html,
            setCookieHeaders: extractSetCookie(subpageRes.headers),
            fetchedAt: new Date().toISOString(),
          });
          return findings;
        } catch {
          warnings.push("A linked page could not be checked.");
          return [];
        }
      }),
    );
  })();

  const dnsChecksPromise = (async (): Promise<Finding[]> => {
    const dnsFindings: Finding[] = [];
    try {
      const [txtRecords, dmarcRecords] = await Promise.all([
        getTxtRecords(targetHost),
        getTxtRecords(`_dmarc.${targetHost}`),
      ]);

      if (!txtRecords || !dmarcRecords)
        warnings.push("Some DNS checks were unavailable.");
      const hasSpf = txtRecords?.some((rec) =>
        rec.toLowerCase().startsWith("v=spf1"),
      );
      if (txtRecords && !hasSpf) {
        dnsFindings.push(createSpfMissingFinding(targetHost));
      }

      const hasDmarc = dmarcRecords?.some((rec) =>
        rec.toLowerCase().startsWith("v=dmarc1"),
      );
      if (dmarcRecords && !hasDmarc) {
        dnsFindings.push(createDmarcMissingFinding(targetHost));
      }
    } catch {
      warnings.push("DNS checks were unavailable.");
    }
    return dnsFindings;
  })();

  const sslCheckPromise = (async (): Promise<Finding[]> => {
    const sslFindings: Finding[] = [];
    try {
      const sslDetails = await checkSslCertificate(targetHostname);
      if (sslDetails) {
        const { daysRemaining, expiryDate } = sslDetails;
        if (daysRemaining <= 7) {
          sslFindings.push(
            createSslExpirationFinding(
              targetHost,
              daysRemaining,
              expiryDate,
              "critical",
            ),
          );
        } else if (daysRemaining <= 15) {
          sslFindings.push(
            createSslExpirationFinding(
              targetHost,
              daysRemaining,
              expiryDate,
              "high",
            ),
          );
        } else if (daysRemaining <= 30) {
          sslFindings.push(
            createSslExpirationFinding(
              targetHost,
              daysRemaining,
              expiryDate,
              "medium",
            ),
          );
        }
      } else {
        warnings.push("Certificate expiry could not be checked.");
      }
    } catch {
      warnings.push("Certificate expiry could not be checked.");
    }
    return sslFindings;
  })();

  const filesChecksPromise = (async (): Promise<Finding[]> => {
    const filesFindings: Finding[] = [];
    try {
      const [robotsRes, securityRes] = await Promise.all([
        fetchPublicUrl(`${origin}/robots.txt`, {
          signal: AbortSignal.timeout(3000),
        }).catch(() => null),
        fetchPublicUrl(`${origin}/.well-known/security.txt`, {
          signal: AbortSignal.timeout(3000),
        }).catch(() => null),
      ]);

      if (robotsRes?.response.status === 404) {
        filesFindings.push(createRobotsMissingFinding(targetHost));
      }

      if (securityRes?.response.status === 404) {
        filesFindings.push(createSecurityTxtMissingFinding(targetHost));
      }
      if (
        !robotsRes ||
        !securityRes ||
        ![200, 404].includes(robotsRes.response.status) ||
        ![200, 404].includes(securityRes.response.status)
      )
        warnings.push("Some public file checks were unavailable.");
      await Promise.all([
        robotsRes?.response.body?.cancel(),
        securityRes?.response.body?.cancel(),
      ]);
    } catch {
      warnings.push("Some public file checks were unavailable.");
    }
    return filesFindings;
  })();

  // Run all subpage fetching, DNS queries, SSL handshakes, and file checks in parallel
  const [subpageFindingsList, dnsFindings, sslFindings, filesFindings] =
    await Promise.all([
      crawlSubpagesPromise,
      dnsChecksPromise,
      sslCheckPromise,
      filesChecksPromise,
    ]);

  // 6. Deduplicate & Merge Findings
  const allRawFindings = [
    ...primaryFindings,
    ...subpageFindingsList.flat(),
    ...dnsFindings,
    ...sslFindings,
    ...filesFindings,
  ];

  const mergedFindings: Finding[] = [];
  const findingsByTitle = new Map<
    string,
    { finding: Finding; affectedUrls: Set<string> }
  >();

  for (const f of allRawFindings) {
    const isGlobalAudit =
      f.title.includes("SPF") ||
      f.title.includes("DMARC") ||
      f.title.includes("SSL") ||
      f.title.includes("robots.txt") ||
      f.title.includes("security.txt");

    if (isGlobalAudit) {
      mergedFindings.push(f);
      continue;
    }

    const existing = findingsByTitle.get(f.title);
    if (existing) {
      existing.affectedUrls.add(f.affectedUrl);
    } else {
      findingsByTitle.set(f.title, {
        finding: { ...f },
        affectedUrls: new Set([f.affectedUrl]),
      });
    }
  }

  for (const group of findingsByTitle.values()) {
    const { finding, affectedUrls } = group;
    if (affectedUrls.size > 1) {
      const urlsArray = Array.from(affectedUrls);
      const pathsList = urlsArray
        .map((url) => {
          try {
            return new URL(url).pathname || "/";
          } catch {
            return url;
          }
        })
        .join(", ");

      finding.evidence = `${finding.evidence} Affected paths: ${pathsList}`;
    }
    mergedFindings.push(finding);
  }

  const finalFindings = mergedFindings.map((f, idx) => ({
    ...f,
    id: `finding_${String(idx + 1).padStart(3, "0")}`,
  }));

  const score = scoreFindings(finalFindings);

  return withAnalysis({
    id: randomUUID(),
    url: normalized.toString(),
    normalizedUrl: requestedUrl,
    host: targetHost,
    status: "completed",
    score,
    summary: summarizeFindings(finalFindings, score),
    startedAt,
    completedAt: new Date().toISOString(),
    findings: finalFindings,
    metadata: {
      finalUrl,
      statusCode: primaryResponse.status,
      fetchedAt,
      pageTitle: primaryInventory.title,
      thirdPartyScriptCount: primaryInventory.scripts.filter(
        (script) => !script.includes(targetHost),
      ).length,
      formCount: primaryInventory.forms.length,
      trustSignalCount: primaryInventory.trustSignals.length,
      responseHeaders: Object.fromEntries(
        Object.entries(primaryHeaders).filter(([key]) =>
          [
            "content-security-policy",
            "strict-transport-security",
            "x-frame-options",
            "x-content-type-options",
            "referrer-policy",
            "permissions-policy",
            "content-type",
          ].includes(key),
        ),
      ),
      crawledPagesCount,
      warnings: [...new Set(warnings)],
    },
  });
}

export function runStaticHtmlScan(
  rawUrl: string,
  html: string,
  headers: Record<string, string> = {},
): ScanResult {
  const startedAt = new Date().toISOString();
  const normalized = normalizeScanUrl(rawUrl);
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const fetchedAt = new Date().toISOString();
  const { findings, inventory } = runPassiveRules({
    requestedUrl: normalized.toString(),
    finalUrl: normalized.toString(),
    statusCode: 200,
    headers: normalizedHeaders,
    html,
    setCookieHeaders: [],
    fetchedAt,
  });
  const score = scoreFindings(findings);

  return withAnalysis({
    id: "static-scan",
    url: normalized.toString(),
    normalizedUrl: normalized.toString(),
    host: getRegistrableHost(normalized.toString()),
    status: "completed",
    score,
    summary: summarizeFindings(findings, score),
    startedAt,
    completedAt: fetchedAt,
    findings,
    metadata: {
      finalUrl: normalized.toString(),
      statusCode: 200,
      fetchedAt,
      pageTitle: inventory.title,
      thirdPartyScriptCount: inventory.scripts.length,
      formCount: inventory.forms.length,
      trustSignalCount: inventory.trustSignals.length,
      responseHeaders: normalizedHeaders,
    },
  });
}
