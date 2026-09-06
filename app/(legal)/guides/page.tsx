import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Scan guide",
  description: "Understand Selrano scans, findings, fix prompts, and Copilot.",
};
export default function GuidesPage() {
  return (
    <article className="max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
        The Selrano guide
      </p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.035em]">
        A clear path from scan to fix.
      </h1>
      <div className="mt-10 space-y-9">
        {[
          [
            "1. Scan a public website",
            "Enter a website you own or have permission to check. Selrano reads the public page and up to nine linked pages on the same origin. URLs must use HTTP or HTTPS on standard web ports. Credentials, private addresses, and local networks are not accepted. Query strings and fragments are removed to avoid carrying login tokens into a scan.",
          ],
          [
            "2. Read the evidence",
            "Findings cover headers, transport security, cookies and forms, frontend exposure patterns, and public trust signals. Each finding includes its severity, observed evidence, and remediation guidance. The score summarizes these signals; it is not a certification or a guarantee of security.",
          ],
          [
            "3. Take a prompt to your builder",
            "Copy the prompt for an individual issue or a group of findings. Paste it into your AI coding tool, review the proposed changes, test them, and deploy. The prompts preserve the existing design and ask for a verification plan.",
          ],
          [
            "4. Ask Copilot",
            "Open a completed scan to ask what to prioritize or how to implement a fix in your stack. Copilot uses the saved report and that scan's conversation history. It offers guidance; it does not change your website or deploy code.",
          ],
          [
            "5. Verify with another scan",
            "After deploying a fix, use Scan again. Each result is saved separately so you can revisit the evidence from earlier scans. Scans are manual; there is no automatic monitoring.",
          ],
          [
            "What a passive scan cannot tell you",
            "Selrano does not execute page JavaScript, log into protected pages, inspect repository code, submit forms, or verify database access rules. It cannot rule out every vulnerability. Unavailable checks are listed in scan coverage. Trust and readiness suggestions, such as missing contact links, are not proof of an exploitable security issue.",
          ],
        ].map(([title, text]) => (
          <section key={title}>
            <h2 className="text-lg font-extrabold">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
              {text}
            </p>
          </section>
        ))}
      </div>
      <div className="mt-10 flex gap-3">
        <Link href="/dashboard" className="btn-primary">
          Start a scan
        </Link>
        <Link href="/sample-report" className="btn-secondary">
          View sample report
        </Link>
      </div>
    </article>
  );
}
