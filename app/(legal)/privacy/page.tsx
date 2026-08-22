import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Read ${brand.name}'s Privacy Policy.`
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--muted-strong)]">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <article>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Privacy Policy</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
        Your Privacy at {brand.name}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-[var(--muted-strong)]">
        Selrano is built from the ground up to be a calm, private sanctuary for your thoughts, decisions, and personal ideas. We will never sell your personal data or use your private conversations to train public AI models.
      </p>

      <Section title="1. Information We Collect">
        <p>We only collect the information necessary to provide you with a durable, personalized thinking space:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm">
          <li><strong>Account Data:</strong> Your email address and full name to manage your workspace and login session.</li>
          <li><strong>Personal Thinking Materials:</strong> Notes, uploaded files, and chat messages you choose to enter into Selrano.</li>
          <li><strong>Durable Memories:</strong> Lasting facts, goals, and communication preferences retained in your Memory Bank.</li>
        </ul>
      </Section>

      <Section title="2. Zero AI Training on User Data">
        <p>
          We do not train foundation models on your private messages or documents. AI inference is performed using enterprise API agreements (Anthropic and Groq) where your data is not stored or reused for model training.
        </p>
      </Section>

      <Section title="3. Third-Party Infrastructure Providers">
        <p>
          To deliver reliable performance, we partner with trusted cloud providers:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm">
          <li><strong>Supabase:</strong> Encrypted PostgreSQL database, authentication, and secure file storage.</li>
          <li><strong>Vercel:</strong> Application hosting and edge routing.</li>
          <li><strong>Stripe:</strong> Secure billing and subscription management.</li>
          <li><strong>Resend:</strong> Transactional emails and weekly reflection digests.</li>
        </ul>
      </Section>

      <Section title="4. Your Rights & Data Control">
        <p>
          You have full authority over your data. You can view, search, and delete memories in your Memory Bank, download or delete notes and files, or permanently erase your entire account in Settings.
        </p>
      </Section>

      <Section title="5. Contact Us">
        <p>
          If you have questions regarding our privacy practices, contact us at{" "}
          <a href={`mailto:${brand.emails.privacy}`} className="font-bold text-[var(--text)] underline">
            {brand.emails.privacy}
          </a>
          .
        </p>
      </Section>
    </article>
  );
}
