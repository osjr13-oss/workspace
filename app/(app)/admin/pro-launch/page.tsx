"use client";

import { useState } from "react";
import { Send, Search } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace-header";

type ProLaunchResult = {
  dryRun?: boolean;
  count?: number;
  recipients?: string[];
  sent?: number;
  failed?: number;
  remaining?: number;
  failures?: Array<{ email: string; error: string }>;
  error?: string;
};

export default function ProLaunchAdminPage() {
  const [result, setResult] = useState<ProLaunchResult | null>(null);
  const [loading, setLoading] = useState<"preview" | "send" | null>(null);

  async function run(kind: "preview" | "send") {
    setLoading(kind);
    setResult(null);

    const response = await fetch("/api/email/pro-live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun: kind === "preview", limit: 25 })
    });

    const payload = (await response.json()) as ProLaunchResult;
    setResult(response.ok ? payload : { error: payload.error || "Request failed." });
    setLoading(null);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title="Pro launch email" eyebrow="Admin" />

      <section className="panel space-y-5 p-6">
        <p className="text-sm leading-6 text-[var(--muted-strong)]">
          Email the old Pro waitlist now that billing is live. Preview first, then send in batches until remaining is 0.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" onClick={() => run("preview")} disabled={Boolean(loading)}>
            <Search size={18} />
            {loading === "preview" ? "Checking..." : "Preview next batch"}
          </button>
          <button type="button" className="btn-primary" onClick={() => run("send")} disabled={Boolean(loading)}>
            <Send size={18} />
            {loading === "send" ? "Sending..." : "Send next batch"}
          </button>
        </div>
      </section>

      {result ? (
        <section className="panel p-6">
          {result.error ? (
            <p className="text-sm font-bold text-[var(--critical)]">{result.error}</p>
          ) : result.dryRun ? (
            <div>
              <p className="text-sm font-bold">Next batch: {result.count || 0}</p>
              <ul className="mt-4 space-y-2 text-sm text-[var(--muted-strong)]">
                {(result.recipients || []).map((email) => (
                  <li key={email}>{email}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-[var(--muted-strong)]">
              <p><strong>{result.sent || 0}</strong> sent</p>
              <p><strong>{result.failed || 0}</strong> failed</p>
              <p><strong>{result.remaining || 0}</strong> remaining</p>
              {result.failures?.length ? (
                <ul className="mt-4 space-y-2 text-[var(--critical)]">
                  {result.failures.map((failure) => (
                    <li key={failure.email}>{failure.email}: {failure.error}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
