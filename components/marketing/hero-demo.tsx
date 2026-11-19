"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Check, FileText, FolderOpen, MessageSquare, NotebookPen, Paperclip } from "lucide-react";

/**
 * A scripted, looping picture of Selrano answering from a user's own sources.
 * Built from the same visual language as the real chat (user bubble, answer
 * prose, citation markers) so the promise matches the product.
 */

type Segment = string | { cite: 1 | 2 };

const QUESTION = "What happens if I move out before my lease ends?";

const ANSWER: Segment[] = [
  "You can leave early, but the lease asks for 60 days of written notice and a break fee equal to two months of rent.",
  { cite: 1 },
  " Your deposit comes back within 30 days once the apartment passes the move-out inspection.",
  { cite: 1 },
  " Your notes from the call with your landlord say the carpet cleaning charge will be waived.",
  { cite: 2 }
];

// Flatten into word-sized steps so the answer streams like the real thing.
const STEPS: Segment[] = ANSWER.flatMap((part): Segment[] => (typeof part === "string" ? part.split(/(?<= )/) : [part]));

const LOOP_MS = 14_000;
const T_QUESTION = 300;
const T_SEARCH = 900;
const T_STREAM = 2_000;
const WORD_MS = 70;
const T_DONE = T_STREAM + STEPS.length * WORD_MS;
const T_CHIPS = T_DONE + 500;
const T_FADE = LOOP_MS - 900;
const FINAL_FRAME = T_CHIPS + 1_000;

function useLoopClock(paused: boolean, reduced: boolean) {
  const [time, setTime] = useState(reduced ? FINAL_FRAME : 0);
  useEffect(() => {
    if (reduced) {
      setTime(FINAL_FRAME);
      return;
    }
    if (paused) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min(now - last, 120);
      last = now;
      setTime((current) => (current + delta) % LOOP_MS);
    }, 40);
    return () => window.clearInterval(id);
  }, [paused, reduced]);
  return time;
}

export function HeroDemo() {
  const reduced = Boolean(useReducedMotion());
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [tabHidden, setTabHidden] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(node);
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const time = useLoopClock(!inView || tabHidden, reduced);
  const shownSteps = time < T_STREAM ? 0 : Math.min(STEPS.length, Math.floor((time - T_STREAM) / WORD_MS) + 1);
  const visible = STEPS.slice(0, shownSteps);
  const lastCite = [...visible].reverse().find((step): step is { cite: 1 | 2 } => typeof step !== "string");
  const activeSource = lastCite?.cite ?? 0;
  const searching = time >= T_SEARCH && time < T_STREAM;
  const streaming = shownSteps > 0 && shownSteps < STEPS.length;
  const fading = !reduced && time >= T_FADE;

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label="Selrano answering a question about breaking a lease from the lease PDF and personal notes. Each claim is numbered, and the cited passage on page 9 is highlighted. The answer is then saved as a note."
      className="relative"
    >
      <div aria-hidden="true" className="overflow-hidden rounded-[22px] border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-lift)]">
        {/* Window bar */}
        <div className="flex h-11 items-center justify-between border-b border-[var(--border)] bg-[var(--background-elevated)] px-4">
          <div className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
            <FolderOpen size={14} />
            <span className="font-medium text-[var(--muted-strong)]">Apartment</span>
            <span className="text-[var(--border-strong)]">/</span>
            <span className="truncate">Moving out early</span>
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_300px] lg:grid-cols-[210px_1fr_310px]">
          {/* Sources rail */}
          <aside className="hidden border-r border-[var(--border)] bg-[var(--surface-sunken)] p-3 lg:block">
            <p className="px-2 pb-2 pt-1 text-[12px] font-medium text-[var(--muted)]">Sources</p>
            <SourceRow icon={<FileText size={15} />} name="Lease agreement.pdf" meta="14 pages" active={activeSource === 1} />
            <SourceRow icon={<NotebookPen size={15} />} name="Move-out notes" meta="Note" active={activeSource === 2} />
            <SourceRow icon={<FileText size={15} />} name="Renters insurance.pdf" meta="6 pages" active={false} />
            <p className="px-2 pb-2 pt-5 text-[12px] font-medium text-[var(--muted)]">Chats</p>
            {["Moving out early", "Packing checklist", "Insurance questions"].map((title, index) => (
              <div
                key={title}
                className={`flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[13px] ${
                  index === 0 ? "bg-[var(--surface)] font-medium text-[var(--text)] shadow-[0_0_0_1px_var(--border)]" : "text-[var(--muted-strong)]"
                }`}
              >
                <MessageSquare size={13} className="shrink-0 text-[var(--muted)]" />
                <span className="truncate">{title}</span>
              </div>
            ))}
          </aside>

          {/* Conversation */}
          <div className={`flex h-[530px] flex-col transition-opacity duration-700 sm:h-[450px] md:h-[430px] ${fading ? "opacity-0" : "opacity-100"}`}>
            <div className="flex-1 space-y-5 overflow-hidden px-5 pt-6 sm:px-7">
              <motion.div
                initial={false}
                animate={{ opacity: time >= T_QUESTION ? 1 : 0, y: time >= T_QUESTION ? 0 : 6 }}
                transition={{ duration: 0.35 }}
                className="flex justify-end"
              >
                <div className="user-bubble text-[14px] leading-6">{QUESTION}</div>
              </motion.div>

              <div className="min-h-[200px]">
                {searching ? (
                  <div className="tool-status text-[13px]">
                    <span className="tool-status-dot" />
                    Reading your lease and notes
                  </div>
                ) : null}
                {shownSteps > 0 ? (
                  <p className="text-[15px] leading-[1.75] text-[var(--text)]">
                    {visible.map((step, index) =>
                      typeof step === "string" ? (
                        <span key={index}>{step}</span>
                      ) : (
                        <span
                          key={index}
                          className={`mx-0.5 inline-flex h-[17px] min-w-[17px] -translate-y-[3px] items-center justify-center rounded-[5px] border px-1 align-middle text-[10px] font-semibold leading-none transition-colors duration-300 ${
                            activeSource === step.cite && index === visible.length - 1
                              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                              : "border-[var(--accent-ring)] bg-[var(--accent-soft)] text-[var(--accent)]"
                          }`}
                        >
                          {step.cite}
                        </span>
                      )
                    )}
                    {streaming ? <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-[3px] animate-pulse bg-[var(--accent)]" /> : null}
                  </p>
                ) : null}

                <AnimatePresence>
                  {time >= T_CHIPS ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="mt-5 flex flex-wrap gap-x-5 gap-y-2"
                    >
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--muted-strong)]">
                        <Check size={13} className="text-[var(--low)]" strokeWidth={2.5} />
                        Saved to Notes
                      </span>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>

            <div className="px-4 pb-4 sm:px-6">
              <div className="composer flex items-center gap-2 px-3 py-2.5 shadow-none">
                <Paperclip size={16} className="text-[var(--muted)]" />
                <span className="flex-1 text-[14px] text-[var(--muted)]">Ask a follow-up</span>
                <span className="send-button h-8 w-8 opacity-30">
                  <ArrowUp size={15} />
                </span>
              </div>
            </div>
          </div>

          {/* Source preview */}
          <div className="hidden border-l border-[var(--border)] bg-[var(--background-elevated)] md:block">
            <AnimatePresence mode="wait" initial={false}>
              {activeSource === 2 ? (
                <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="p-5">
                  <PreviewHeader icon={<NotebookPen size={14} />} title="Move-out notes" tag="Note" />
                  <p className="mt-5 font-display text-[19px] leading-tight text-[var(--text)]">Call with landlord, Nov 3</p>
                  <ul className="mt-3 space-y-2.5 text-[13px] leading-[1.6] text-[var(--muted-strong)]">
                    <li>Move-out date can be any day of the month.</li>
                    <li>
                      <Highlight on>Carpet cleaning charge waived since the carpet is original.</Highlight>
                    </li>
                    <li>Send the notice by email and keep a copy.</li>
                  </ul>
                </motion.div>
              ) : (
                <motion.div key="pdf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="p-5">
                  <PreviewHeader icon={<FileText size={14} />} title="Lease agreement.pdf" tag="Page 9" />
                  <p className="mt-5 font-display text-[19px] leading-tight text-[var(--text)]">12. Early termination</p>
                  <p className="mt-3 text-[13px] leading-[1.7] text-[var(--muted-strong)]">
                    Tenant may end this lease before the term expires.{" "}
                    <Highlight on={activeSource === 1}>
                      Tenant must give 60 days of written notice and pay a fee equal to two months of rent. The deposit is returned within
                      30 days after the move-out inspection.
                    </Highlight>{" "}
                    Rent is due through the notice period.
                  </p>
                  <div className="mt-5 space-y-2">
                    <div className="h-2 w-full rounded-full bg-[var(--surface-subtle)]" />
                    <div className="h-2 w-5/6 rounded-full bg-[var(--surface-subtle)]" />
                    <div className="h-2 w-2/3 rounded-full bg-[var(--surface-subtle)]" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceRow({ icon, name, meta, active }: { icon: React.ReactNode; name: string; meta: string; active: boolean }) {
  return (
    <div
      className={`mb-1 flex items-center gap-2.5 rounded-[10px] px-2 py-2 transition-colors duration-300 ${
        active ? "bg-[var(--surface)] shadow-[0_0_0_1px_var(--accent-ring)]" : ""
      }`}
    >
      <span className={`transition-colors duration-300 ${active ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-[var(--text)]">{name}</span>
        <span className="block text-[11.5px] text-[var(--muted)]">{meta}</span>
      </span>
    </div>
  );
}

function PreviewHeader({ icon, title, tag }: { icon: React.ReactNode; title: string; tag: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-medium text-[var(--muted-strong)]">
        <span className="text-[var(--accent)]">{icon}</span>
        <span className="truncate">{title}</span>
      </span>
      <span className="shrink-0 text-[12px] text-[var(--muted)]">{tag}</span>
    </div>
  );
}

function Highlight({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className="rounded-[3px] px-0.5 text-[var(--text)] transition-[background-size] duration-700 ease-out [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
      style={{
        backgroundImage: "linear-gradient(var(--highlight), var(--highlight))",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "0 100%",
        backgroundSize: on ? "100% 100%" : "0% 100%"
      }}
    >
      {children}
    </span>
  );
}
