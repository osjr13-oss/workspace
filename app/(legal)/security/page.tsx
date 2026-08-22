import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Security",
  description: `Security practices and privacy safeguards for ${brand.name}.`
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--muted-strong)]">{children}</div>
    </section>
  );
}

export default function SecurityPage() {
  return (
    <article>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Trust &amp; Security</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
        Security and Privacy at {brand.name}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-[var(--muted-strong)]">
        Selrano is built as a private personal thinking companion. We treat your personal reflections, decisions, notes, and uploaded documents with strict data isolation and industry-standard security.
      </p>

      <Section title="Infrastructure & Isolation">
        <p>
          Application hosting is powered by Vercel. Database storage, authentication, and encrypted file storage run on Supabase (PostgreSQL with strict row-level security). Every database query executes strictly within the authenticated user boundary.
        </p>
      </Section>

      <Section title="AI Privacy & Model Usage">
        <p>
          Your thoughts, conversations, notes, and uploaded files are <strong>never used to train third-party AI models</strong>. We partner with leading enterprise model providers (Anthropic and Groq) under strict zero-data-retention and zero-training policies.
        </p>
      </Section>

      <Section title="Encryption in Transit & at Rest">
        <p>
          All network traffic between your browser and Selrano is encrypted in transit using TLS 1.3. User files and database backups are encrypted at rest using AES-256 encryption. Account authentication passwords are encrypted using bcrypt hashing; we never store or see plaintext passwords.
        </p>
      </Section>

      <Section title="Durable Memory Sovereignty">
        <p>
          You retain complete ownership and control over everything Selrano remembers. You can open your Memory Bank at any time to view every remembered fact, search entries, manually delete specific memories, or permanently wipe your account and all associated data.
        </p>
      </Section>

      <Section title="Vulnerability Disclosure">
        <p>
          If you believe you have discovered a security issue, please contact us directly at{" "}
          <a href={`mailto:${brand.emails.security}`} className="font-bold text-[var(--text)] underline">
            {brand.emails.security}
          </a>
          . We appreciate responsible disclosure and acknowledge all security inquiries within 2 business days.
        </p>
      </Section>

      <Section title="Related Information">
        <p>
          Read our <Link href="/privacy" className="font-bold text-[var(--text)] underline">Privacy Policy</Link> and{" "}
          <Link href="/terms" className="font-bold text-[var(--text)] underline">Terms of Service</Link>, or contact us at{" "}
          <a href={`mailto:${brand.emails.support}`} className="font-bold text-[var(--text)] underline">
            {brand.emails.support}
          </a>
          .
        </p>
      </Section>
    </article>
  );
}
