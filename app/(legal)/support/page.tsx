import type { Metadata } from "next";
import { HelpCircle, Mail, Clock } from "lucide-react";
import { SupportContactForm } from "@/components/support-contact-form";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Support — ${brand.name}`,
  description: `Contact ${brand.name} support. Response within ${brand.support.responseSla}.`
};

const faqs = [
  {
    q: "How do I reset my password?",
    a: "Use Settings → Send reset email, or the Reset password page. You will set a new password on a secure page after clicking the email link."
  },
  {
    q: "How is my data protected?",
    a: "Data is stored in Supabase with row-level security. Files are private to your account. See our Security page for details."
  },
  {
    q: "How do I delete my account?",
    a: "Go to Settings → Danger zone → Delete my account. This permanently removes your data."
  }
];

export default function SupportPage() {
  return (
    <article>
      <p className="text-sm font-bold text-[var(--muted)]">Customer support</p>
      <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.035em] text-[var(--text)]">How can we help?</h1>
      <p className="mt-4 text-base leading-7 text-[var(--muted-strong)]">
        Our team typically responds within <strong>{brand.support.responseSla}</strong> ({brand.support.hours}).
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="glass-card p-5">
          <Mail size={20} />
          <p className="mt-4 text-sm font-extrabold">Email</p>
          <a href={`mailto:${brand.emails.support}`} className="mt-2 block text-sm font-bold text-[var(--text)]">
            {brand.emails.support}
          </a>
        </div>
        <div className="glass-card p-5">
          <Clock size={20} />
          <p className="mt-4 text-sm font-extrabold">Response time</p>
          <p className="mt-2 text-sm text-[var(--muted-strong)]">{brand.support.responseSla}</p>
        </div>
        <div className="glass-card p-5">
          <HelpCircle size={20} />
          <p className="mt-4 text-sm font-extrabold">Security issues</p>
          <a href={`mailto:${brand.emails.security}`} className="mt-2 block text-sm font-bold text-[var(--text)]">
            {brand.emails.security}
          </a>
        </div>
      </div>

      <h2 className="mt-12 text-2xl font-extrabold tracking-[-0.02em]">Send a message</h2>
      <div className="mt-6">
        <SupportContactForm />
      </div>

      <h2 className="mt-12 text-2xl font-extrabold tracking-[-0.02em]">Common questions</h2>
      <div className="mt-6 space-y-4">
        {faqs.map((item) => (
          <div key={item.q} className="panel p-5">
            <p className="font-extrabold">{item.q}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">{item.a}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
