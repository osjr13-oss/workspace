import type { Metadata } from "next";
import { Mail, Clock, HelpCircle } from "lucide-react";
import { SupportContactForm } from "@/components/support-contact-form";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Support",
  description: `Get help and contact ${brand.name} support.`
};

const faqs = [
  {
    q: "How does the Memory Bank work?",
    a: "As you think out loud and talk through decisions in chat, Selrano automatically notes key lasting facts and goals. You can also explicitly tell Selrano to remember something, or open your Memory Bank in Settings to view, search, add, or delete memories."
  },
  {
    q: "How is my data kept private?",
    a: "All personal thoughts, notes, and uploaded files are isolated with row-level security. We never use your conversations or private files to train third-party AI models."
  },
  {
    q: "What is the difference between Free and Pro?",
    a: "Free includes 5 saved memories, basic recent recall, 3 projects, and standard upload limits. Pro unlocks an unlimited memory bank, deep cross-conversation recall, weekly memory reflection emails, and unlimited projects."
  },
  {
    q: "How do I delete my account?",
    a: "Go to Settings → Danger zone → Delete my account. This permanently removes all your chat history, notes, files, memories, and personal data."
  }
];

export default function SupportPage() {
  return (
    <article>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Support & Help</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
        How can we help?
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-[var(--muted-strong)]">
        Have a question, feedback, or need help with your workspace? We typically respond within <strong>{brand.support.responseSla}</strong> ({brand.support.hours}).
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="panel p-5 bg-white shadow-xs space-y-2">
          <Mail size={18} className="text-slate-900" />
          <p className="text-xs font-bold text-[var(--text)]">Direct Email</p>
          <a href={`mailto:${brand.emails.support}`} className="block text-xs font-semibold text-slate-700 hover:underline">
            {brand.emails.support}
          </a>
        </div>
        <div className="panel p-5 bg-white shadow-xs space-y-2">
          <Clock size={18} className="text-slate-900" />
          <p className="text-xs font-bold text-[var(--text)]">Response Time</p>
          <p className="text-xs text-[var(--muted-strong)]">{brand.support.responseSla}</p>
        </div>
        <div className="panel p-5 bg-white shadow-xs space-y-2">
          <HelpCircle size={18} className="text-slate-900" />
          <p className="text-xs font-bold text-[var(--text)]">General Inquiries</p>
          <p className="text-xs text-[var(--muted-strong)]">Billing, privacy, feedback, and technical support</p>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">Send us a message</h2>
        <div className="mt-4">
          <SupportContactForm />
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">Common questions</h2>
        <div className="mt-4 space-y-3">
          {faqs.map((item) => (
            <div key={item.q} className="panel p-5 bg-white shadow-xs space-y-1.5">
              <p className="text-sm font-bold text-[var(--text)]">{item.q}</p>
              <p className="text-xs leading-relaxed text-[var(--muted-strong)]">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
