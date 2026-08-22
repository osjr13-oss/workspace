"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, LifeBuoy, Mail, Shield, FileText } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";
import { SupportContactForm } from "@/components/support-contact-form";
import { brand } from "@/lib/brand";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function HelpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email || "");
      const meta = data.user?.user_metadata?.full_name || "";
      if (meta) setName(meta);
      else if (data.user) {
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", data.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile?.full_name) setName(profile.full_name);
          });
      }
    });
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-5 py-8 sm:px-8">
      <WorkspaceHeader title="Help & Support" eyebrow="Assistance">
        <Link href="/support" className="btn-secondary" target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} />
          Public Support
        </Link>
      </WorkspaceHeader>

      <section className="panel p-6 bg-white shadow-xs">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
            <LifeBuoy size={20} />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-[var(--text)]">We are here to help</h2>
            <p className="text-xs leading-relaxed text-[var(--muted-strong)]">
              Typical response time: <strong>{brand.support.responseSla}</strong> ({brand.support.hours}).
              You can also email us directly at{" "}
              <a href={`mailto:${brand.emails.support}`} className="font-bold text-[var(--text)] underline">
                {brand.emails.support}
              </a>
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-[var(--text)]">Send us a direct message</h3>
        <SupportContactForm defaultName={name} defaultEmail={email} />
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <Link href="/security" className="btn-secondary text-xs" target="_blank" rel="noopener noreferrer">
          <Shield size={14} />
          <span>Security Practices</span>
        </Link>
        <Link href="/privacy" className="btn-secondary text-xs" target="_blank" rel="noopener noreferrer">
          <FileText size={14} />
          <span>Privacy Policy</span>
        </Link>
        <Link href="/terms" className="btn-secondary text-xs" target="_blank" rel="noopener noreferrer">
          <FileText size={14} />
          <span>Terms of Service</span>
        </Link>
      </div>
    </div>
  );
}
