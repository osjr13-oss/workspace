"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, X } from "lucide-react";
import { removeEmDashes } from "@/lib/text";

type ToastAction = { label: string; href?: string; onClick?: () => void };
export type ToastInput = { title: string; description?: string; tone?: "success" | "error" | "info"; action?: ToastAction };
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);
const DURATION = 4200;
const MAX_VISIBLE = 3;

/** Small notices that confirm an action ("Note saved") and fade away on their own. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const push = useCallback((toast: ToastInput) => {
    const id = nextId.current++;
    setItems((current) => [...current, { ...toast, id }].slice(-MAX_VISIBLE));
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-region" aria-live="polite" aria-label="Notifications">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(onDismiss, item.tone === "error" ? DURATION + 2000 : DURATION);
    return () => window.clearTimeout(timer);
  }, [paused, onDismiss, item.tone]);

  const error = item.tone === "error";
  const action = item.action;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.16 } }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      role={error ? "alert" : "status"}
      className="toast"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className={`toast-icon ${error ? "toast-icon-error" : ""}`} aria-hidden="true">
        {error ? <AlertCircle size={15} /> : <Check size={15} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-5">{removeEmDashes(item.title)}</p>
        {item.description ? <p className="mt-0.5 text-[13px] leading-5 text-[var(--muted-strong)]">{removeEmDashes(item.description)}</p> : null}
      </div>
      {action ? (
        action.href ? (
          <Link href={action.href} className="toast-action" onClick={onDismiss}>
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            className="toast-action"
            onClick={() => {
              action.onClick?.();
              onDismiss();
            }}
          >
            {action.label}
          </button>
        )
      ) : null}
      <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={onDismiss}>
        <X size={14} />
      </button>
    </motion.div>
  );
}

/** Returns toast(); a no-op outside the app frame so shared components stay safe to render anywhere. */
export function useToast() {
  const push = useContext(ToastContext);
  return useMemo(() => push ?? (() => undefined), [push]);
}
