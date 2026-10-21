"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

const DISMISS_KEY = "selrano-pwa-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaProvider() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
        console.warn("[pwa] service worker registration failed", error);
      });
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setShowHint(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    if (isIos() && !isStandalone()) {
      setIosHint(true);
      setShowHint(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShowHint(false);
    setInstallEvent(null);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    dismiss();
  }

  if (!showHint) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:inset-x-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold tracking-[-0.01em]">Install Selrano</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-strong)]">
            {iosHint ? (
              <>
                Tap <Share size={14} className="inline align-text-bottom" /> Share, then <strong>Add to Home Screen</strong> so logging a meal is one tap away.
              </>
            ) : (
              "Add Selrano to your home screen for a full-screen app experience."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-xl p-1 text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
          aria-label="Dismiss install hint"
        >
          <X size={18} />
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {!iosHint && installEvent ? (
          <button type="button" onClick={install} className="btn-primary min-h-10 px-4 text-sm">
            <Download size={16} />
            Install app
          </button>
        ) : null}
        <button type="button" onClick={dismiss} className="btn-secondary min-h-10 px-4 text-sm">
          Not now
        </button>
      </div>
    </div>
  );
}
