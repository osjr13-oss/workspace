import Link from "next/link";
import { SupportContactForm } from "@/components/support-contact-form";
export default function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-7 px-5 py-10">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
          Help & support
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          A little help with your next step.
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Understand a scan, work through a fix, or get help with your account.
        </p>
      </header>
      <section className="panel p-6">
        <h2 className="font-extrabold">Getting started</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
          Scan a public website, read the observed evidence, and copy a fix
          prompt into your AI builder. For questions about a particular finding,
          open Copilot in that scan&apos;s report.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/guides" className="btn-secondary">
            Read the scan guide
          </Link>
          <Link href="/copilot" className="btn-secondary">
            Open Copilot
          </Link>
        </div>
      </section>
      <section className="panel p-6">
        <h2 className="mb-5 font-extrabold">Contact support</h2>
        <SupportContactForm />
      </section>
    </div>
  );
}
