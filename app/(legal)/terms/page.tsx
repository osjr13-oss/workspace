import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Read ${brand.name}'s Terms of Service.`
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[var(--muted-strong)]">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <article>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Legal Terms</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
        Terms of Service
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-[var(--muted-strong)]">
        Please read these Terms of Service carefully before using Selrano. By creating an account or using the service, you agree to these terms.
      </p>

      <Section title="1. Overview of the Service">
        <p>
          Selrano is a personal thinking companion with durable memory. It helps everyday individuals talk through decisions, organize ideas, take notes, upload files, and recall key context across conversations with grounded AI capabilities.
        </p>
      </Section>

      <Section title="2. Account Registration & Security">
        <p>
          You must provide a valid email address to create an account. You are responsible for maintaining the security of your credentials and all activity on your account. Contact us immediately at {brand.emails.support} if you notice unauthorized access.
        </p>
      </Section>

      <Section title="3. User Content & Ownership">
        <p>
          You retain complete ownership of all notes, conversations, files, and memories you create in Selrano. We do not claim ownership of your thoughts and do not sell your personal data.
        </p>
      </Section>

      <Section title="4. Acceptable Use">
        <p>
          You agree to use Selrano only for lawful personal or professional purposes. You may not use the service to generate harmful, illegal, or abusive content, reverse-engineer the platform, or compromise infrastructure security.
        </p>
      </Section>

      <Section title="5. Subscriptions & Billing">
        <p>
          Selrano offers a Free plan and an optional Pro subscription. Pro subscriptions are billed monthly via Stripe and can be canceled anytime from your account Settings.
        </p>
      </Section>

      <Section title="6. Limitation of Liability">
        <p>
          The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. Selrano makes no warranties regarding uninterrupted availability or the complete accuracy of AI-generated responses.
        </p>
      </Section>

      <Section title="7. Contact Information">
        <p>
          Questions about these terms can be directed to{" "}
          <a href={`mailto:${brand.emails.support}`} className="font-bold text-[var(--text)] underline">
            {brand.emails.support}
          </a>
          .
        </p>
      </Section>
    </article>
  );
}
