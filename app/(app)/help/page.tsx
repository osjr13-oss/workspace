"use client";

import Link from "next/link";
import { ExternalLink, LifeBuoy } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { SupportContactForm } from "@/components/support-contact-form";
import { useWorkspaceSession } from "@/components/workspace-session";
import { brand } from "@/lib/brand";

export default function HelpPage() {
  const { email, fullName } = useWorkspaceSession();

  return (
    <div className="mx-auto max-w-4xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title="Help & support" eyebrow="Workspace">
        <Link href={brand.urls.support} className="btn-secondary" target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} />
          Public support page
        </Link>
      </WorkspaceHeader>

      <section className="panel p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-subtle)]">
            <LifeBuoy size={22} />
          </span>
          <div>
            <h2 className="text-base font-extrabold">We are here to help</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
              Typical response time: <strong>{brand.support.responseSla}</strong> ({brand.support.hours}).
              Email us at{" "}
              <a href={`mailto:${brand.emails.support}`} className="font-bold text-[var(--text)]">
                {brand.emails.support}
              </a>
            </p>
          </div>
        </div>
      </section>

      <SupportContactForm defaultName={fullName} defaultEmail={email} />

      <div className="flex flex-wrap gap-3 text-sm font-bold">
        <Link href={brand.urls.security} className="btn-secondary" target="_blank" rel="noopener noreferrer">
          Security
        </Link>
        <Link href={brand.urls.privacy} className="btn-secondary" target="_blank" rel="noopener noreferrer">
          Privacy
        </Link>
        <Link href={brand.urls.terms} className="btn-secondary" target="_blank" rel="noopener noreferrer">
          Terms
        </Link>
      </div>
    </div>
  );
}
