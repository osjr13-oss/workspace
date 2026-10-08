"use client";

import { useEffect } from "react";
import { reportClientError } from "@/components/report-client-error";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f7f5f0", color: "#15181f" }}>
        <div style={{ maxWidth: 420, margin: "20vh auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#69707d" }}>Please try again.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, padding: "10px 20px", borderRadius: 999, border: 0, background: "#15181f", color: "#fff" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
