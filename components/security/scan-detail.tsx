"use client";
import { useEffect, useState } from "react";
import type { ScanRow, CopilotMessage } from "@/lib/security/types";
import { SecurityReport } from "./report";
import { ScanForm } from "./scan-form";
import Link from "next/link";

export function ScanDetail({ scanId }: { scanId: string }) {
  const [scan, setScan] = useState<ScanRow | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const response = await fetch(`/api/scans/${scanId}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setScan(data.scan);
        setMessages(data.messages);
        if (
          data.scan.status === "running" &&
          Date.now() - Date.parse(data.scan.created_at) < 120000
        )
          timer = setTimeout(load, 3000);
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : "Could not load scan.",
          );
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [scanId]);
  if (error)
    return (
      <div className="p-8">
        <p role="alert" className="text-sm text-[var(--critical)]">
          {error}
        </p>
        <Link href="/scans" className="btn-secondary mt-5">
          Back to scans
        </Link>
      </div>
    );
  if (!scan)
    return (
      <p role="status" className="p-8 text-sm text-[var(--muted)]">
        Loading your report...
      </p>
    );
  if (scan.report && scan.status === "completed")
    return <SecurityReport scan={scan.report} messages={messages} />;
  const stale = Date.now() - Date.parse(scan.created_at) > 120000;
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <h1 className="text-2xl font-extrabold">
        {scan.status === "failed" || stale
          ? "This scan could not complete."
          : "Your scan is in progress."}
      </h1>
      <p className="text-sm leading-7 text-[var(--muted)]">
        {scan.failure ||
          (stale
            ? "The request was interrupted. You can start a new scan below."
            : "Checking public pages. This report will update when the scan completes.")}
      </p>
      {(scan.status === "failed" || stale) && (
        <ScanForm initialUrl={scan.url} />
      )}
    </div>
  );
}
