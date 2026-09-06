"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  Globe2,
  History,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { ScanForm } from "./scan-form";
import type { ScanRow } from "@/lib/security/types";

export function SecurityDashboard({
  mode = "overview",
}: {
  mode?: "overview" | "history" | "copilot";
}) {
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/scans?page=${page}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setScans(data.scans);
        setTotal(data.total);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error.message || "Could not load scans.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, retry]);
  const heading =
    mode === "history"
      ? "Your scan history"
      : mode === "copilot"
        ? "A little clarity goes a long way."
        : "Build with AI. Launch with confidence.";
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8 lg:py-12">
      <header>
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
          {mode === "copilot" ? "Security copilot" : "Your security overview"}
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight tracking-[-0.035em] sm:text-4xl">
          {heading}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-strong)]">
          {mode === "copilot"
            ? "Open a completed scan to ask questions, understand the evidence, and work through a fix with Selrano."
            : "Know what needs attention, understand why it matters, and take the next step with a clear fix."}
        </p>
      </header>
      {mode === "overview" && (
        <section className="panel p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">
                Start with your website.
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                No code to connect. Just your public URL.
              </p>
            </div>
            <ShieldCheck size={24} className="text-[var(--muted)]" />
          </div>
          <ScanForm />
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--border)] pt-5 text-xs text-[var(--muted)]">
            <span>Passive checks only</span>
            <span>Evidence with every finding</span>
            <span>Prompts for your AI builder</span>
          </div>
        </section>
      )}
      {mode === "overview" && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Globe2,
              title: "01 / Scan",
              text: "Check public pages, headers, forms, and exposure.",
            },
            {
              icon: ArrowDownRight,
              title: "02 / Understand",
              text: "Review prioritized findings with clear evidence.",
            },
            {
              icon: MessageSquare,
              title: "03 / Fix & verify",
              text: "Use a fix prompt, deploy changes, then scan again.",
            },
          ].map((item) => (
            <div key={item.title} className="px-1 py-2">
              <div className="flex items-center gap-3">
                <item.icon size={17} className="text-[var(--muted)]" />
                <h3 className="text-sm font-bold">{item.title}</h3>
              </div>
              <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      )}
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
          <h2 className="font-extrabold">
            {mode === "copilot" ? "Choose a scan" : "Recent scans"}
          </h2>
          <span className="text-xs text-[var(--muted)]">{total} saved</span>
        </div>
        {loading ? (
          <p role="status" className="p-8 text-sm text-[var(--muted)]">
            Loading scans...
          </p>
        ) : error ? (
          <div className="p-8">
            <p role="alert" className="text-sm text-[var(--critical)]">
              {error}
            </p>
            <button
              className="btn-secondary mt-4"
              onClick={() => setRetry((n) => n + 1)}
            >
              Try again
            </button>
          </div>
        ) : !scans.length ? (
          <div className="px-6 py-12 text-center">
            <History size={24} className="mx-auto text-[var(--muted)]" />
            <h3 className="mt-4 font-bold">Your first scan starts here.</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
              Scan a website to build a history of findings and fixes.
            </p>
            <Link
              href={mode === "overview" ? "/sample-report" : "/dashboard"}
              className="btn-secondary mt-5"
            >
              {mode === "overview" ? "Explore a sample report" : "Start a scan"}
              <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {scans.map((scan) => {
              const stale =
                scan.status === "running" &&
                Date.now() - Date.parse(scan.created_at) > 120000;
              return (
                <Link
                  href={`/scans/${scan.id}${mode === "copilot" ? "#copilot" : ""}`}
                  key={scan.id}
                  className="flex items-center gap-4 px-5 py-5 transition-colors hover:bg-[var(--surface-subtle)] sm:px-6"
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[var(--border)] text-sm font-extrabold">
                    {scan.score ?? <Globe2 size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{scan.host}</p>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">
                      {scan.status === "completed"
                        ? `${scan.finding_count} findings · ${new Date(scan.created_at).toLocaleDateString()}`
                        : stale
                          ? "Scan interrupted. Open to try again."
                          : scan.status === "failed"
                            ? "Scan could not complete"
                            : "Scan in progress"}
                    </p>
                  </div>
                  <span className="hidden text-xs text-[var(--muted)] sm:inline">
                    {mode === "copilot" ? "Open Copilot" : "View report"}
                  </span>
                  <ArrowRight
                    size={16}
                    className="shrink-0 text-[var(--muted)]"
                  />
                </Link>
              );
            })}
          </div>
        )}
        {total > 20 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] p-4">
            <button
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => p - 1)}
              className="btn-secondary disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-[var(--muted)]">
              Page {page + 1} of {Math.ceil(total / 20)}
            </span>
            <button
              disabled={(page + 1) * 20 >= total || loading}
              onClick={() => setPage((p) => p + 1)}
              className="btn-secondary disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </section>
      <p className="text-xs leading-6 text-[var(--muted)]">
        Selrano checks observable signals on public pages. A scan cannot verify
        your server code, database permissions, or every vulnerability.
      </p>
    </div>
  );
}
