import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Security",
  description: `Security practices and reporting for ${brand.name}.`
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-extrabold tracking-[-0.02em]">{title}</h2>
      <div className="mt-4 space-y-3 text-base leading-7 text-[var(--muted-strong)]">{children}</div>
    </section>
  );
}

export default function SecurityPage() {
  return (
    <article className="prose-meridian">
      <p className="text-sm font-bold text-[var(--muted)]">Trust &amp; security</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.035em] text-[var(--text)]">Security at {brand.name}</h1>
      <p className="mt-4 text-base text-[var(--muted-strong)]">
        We design {brand.name} with security appropriate for sensitive academic and personal work. This page summarizes
        our practices; enterprise customers may request additional documentation.
      </p>

      <Section title="Infrastructure">
        <p>
          Application hosting runs on Vercel. Data, authentication, and file storage use Supabase (PostgreSQL with
          row-level security). AI inference uses Google Gemini. Billing-enabled Gemini API projects do not use prompts and responses to improve Google products; Search grounding has separate processing and retention terms.
        </p>
      </Section>

      <Section title="Access control">
        <p>
          Every workspace route requires authentication. Database policies restrict all tables so users can only access
          their own rows. API routes validate the session server-side before processing requests.
        </p>
      </Section>

      <Section title="Encryption">
        <p>
          Traffic is encrypted in transit (TLS). Data at rest is encrypted by our cloud providers. Passwords are handled
          by Supabase Auth (bcrypt); we never store plaintext passwords.
        </p>
      </Section>

      <Section title="Operational practices">
        <ul className="list-disc space-y-2 pl-5">
          <li>Environment secrets stored in Vercel, never committed to source control.</li>
          <li>Audit logging for sensitive actions such as account deletion.</li>
          <li>Transactional email via a dedicated provider with domain authentication (SPF/DKIM).</li>
          <li>Regular dependency updates and production builds on every main-branch deploy.</li>
        </ul>
      </Section>

      <Section title="Report a vulnerability">
        <p>
          We do not currently have a public reporting channel. Do not disclose security issues publicly. A contact
          method will be listed here as soon as one is available.
        </p>
      </Section>

      <Section title="Privacy & compliance">
        <p>
          See our <Link href={brand.urls.privacy} className="font-bold text-[var(--text)]">Privacy Policy</Link> for data
          collection and your rights.
        </p>
      </Section>

    </article>
  );
}
