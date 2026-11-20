"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A centred window over a dimmed page. Escape or clicking outside closes it,
 * focus stays inside while it is open, and returns to what opened it afterwards.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = "sm"
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md";
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Read through a ref, so a parent re-rendering while the window is open never resets focus.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const preferred = panel.querySelector<HTMLElement>("[data-autofocus]") || panel.querySelector<HTMLElement>(FOCUSABLE);
      (preferred || panel).focus();
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center sm:p-6">
          <motion.div
            className="dialog-scrim absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            className={`dialog-panel relative w-full ${size === "md" ? "max-w-lg" : "max-w-md"}`}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.14 } }}
            transition={{ type: "spring", stiffness: 460, damping: 36 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id={titleId} className="text-[17px] font-semibold tracking-[-0.01em]">
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} className="mt-1.5 text-[14px] leading-6 text-[var(--muted-strong)]">
                    {description}
                  </p>
                ) : null}
              </div>
              <button type="button" className="icon-button -mr-2 -mt-1.5 shrink-0" aria-label="Close" onClick={onClose}>
                <X size={17} />
              </button>
            </div>
            <div className="mt-5">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

type ConfirmOptions = { title: string; description?: string; confirmLabel?: string; destructive?: boolean };
type ConfirmState = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

/** Provides confirm(): `if (await confirm({ title: "Delete this chat?" })) ...` */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const [open, setOpen] = useState(false);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...options, resolve });
        setOpen(true);
      }),
    []
  );

  const settle = useCallback(
    (ok: boolean) => {
      state?.resolve(ok);
      setOpen(false);
    },
    [state]
  );
  const cancel = useCallback(() => settle(false), [settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onClose={cancel} title={state?.title || ""} description={state?.description}>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={cancel}>
            Cancel
          </button>
          <button
            type="button"
            data-autofocus
            className={`btn-sm ${state?.destructive ? "btn-danger" : "btn-primary"}`}
            onClick={() => settle(true)}
          >
            {state?.confirmLabel || "Confirm"}
          </button>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/** Falls back to the browser's own confirm outside the app frame. */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  return confirm ?? ((options: ConfirmOptions) => Promise.resolve(window.confirm(options.title)));
}
