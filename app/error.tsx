"use client";

import { useEffect } from "react";
import { reportClientError } from "@/components/report-client-error";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-extrabold tracking-[-0.02em]">Something went wrong</h1>
      <p className="text-sm leading-6 text-[var(--muted-strong)]">
        This page hit an unexpected error. Your logs are saved. Try again, or go back to Today.
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <a href="/today" className="btn-secondary">
          Go to Today
        </a>
      </div>
    </div>
  );
}
