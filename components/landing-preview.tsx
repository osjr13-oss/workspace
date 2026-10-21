"use client";

import { useState } from "react";
import { ArrowUpRight, BookOpenText, Files, Globe2, LibraryBig } from "lucide-react";
import { motion } from "framer-motion";
import { useSpotlight } from "@/components/use-spotlight";

const NAV_ITEMS = ["Chats", "Workspace", "Projects", "Files", "Notes", "Flashcards"];

const DETAIL_CARDS = [
  { title: "Style", body: "Direct, concise, and shaped around how you communicate." },
  { title: "Memory", body: "Useful preferences and ongoing work stay available." },
  { title: "Sources", body: "Project files and web results remain clearly cited." },
  { title: "Control", body: "Edit, resend, regenerate, and keep moving." },
];

export function LandingPreview() {
  const { spotlightProps } = useSpotlight<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div
      id="workspace"
      className="panel spotlight overflow-hidden p-4"
      style={{
        ...spotlightProps.style,
        ["--spot-size" as string]: "360px",
      }}
      ref={spotlightProps.ref}
      onMouseMove={spotlightProps.onMouseMove}
      onMouseEnter={spotlightProps.onMouseEnter}
      onMouseLeave={spotlightProps.onMouseLeave}
      data-active={spotlightProps["data-active"]}
    >
      <div className="grid min-h-[520px] grid-cols-[190px_1fr] overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--background-elevated)] max-sm:grid-cols-1">
        <aside
          className="border-r border-[var(--border)] p-4 max-sm:hidden"
          onMouseLeave={() => setHovered(null)}
        >
          {NAV_ITEMS.map((item, index) => {
            const isActive = index === 0;
            const isHovered = hovered === index;
            return (
              <div
                key={item}
                onMouseEnter={() => setHovered(index)}
                className={`relative mb-2 cursor-pointer rounded-2xl px-3 py-3 text-sm font-bold transition-colors duration-200 ${
                  isActive || isHovered ? "text-[var(--text)]" : "text-[var(--muted)]"
                }`}
              >
                {isHovered && (
                  <motion.div
                    layoutId="hoverPill"
                    className="absolute inset-0 rounded-2xl bg-[var(--surface-subtle)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
                  />
                )}
                {isActive && !isHovered && (
                  <span className="absolute inset-0 rounded-2xl bg-[var(--surface-subtle)]" />
                )}
                <span className="relative z-10">{item}</span>
              </div>
            );
          })}
        </aside>
        <div className="p-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">New conversation</p>
          <h2 className="mt-12 text-4xl font-extrabold tracking-[-0.04em]">Think out loud with Selrano.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Start anywhere. Add a project when your own material should guide the answer.</p>
          <motion.div
            className="group panel mt-10 overflow-hidden shadow-none"
            initial={false}
            whileHover={{ y: -2 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
          >
            <div className="flex items-start justify-between gap-6 p-6">
              <div>
                <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
                  <LibraryBig size={14} strokeWidth={2.25} />
                  Grounded workspace
                </p>
                <p className="mt-4 text-xl font-extrabold tracking-[-0.025em]">Every source stays in its place.</p>
                <p className="mt-1 max-w-md text-sm leading-6 text-[var(--muted)]">
                  Bring notes, files, and live research into one answer without losing where anything came from.
                </p>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--text)] text-white transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                <ArrowUpRight size={18} strokeWidth={2.25} />
              </span>
            </div>
            <div className="grid grid-cols-3 border-t border-[var(--border)] bg-white/38">
              {[
                { label: "Notes", Icon: BookOpenText },
                { label: "Files", Icon: Files },
                { label: "Live web", Icon: Globe2 }
              ].map(({ label, Icon }, index) => (
                <div
                  key={label}
                  className={`flex items-center gap-2.5 px-4 py-3 text-xs font-bold text-[var(--muted-strong)] ${
                    index > 0 ? "border-l border-[var(--border)]" : ""
                  }`}
                >
                  <Icon size={15} strokeWidth={2.1} className="text-[var(--muted)]" />
                  {label}
                </div>
              ))}
            </div>
          </motion.div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {DETAIL_CARDS.map((item) => (
              <motion.div
                key={item.title}
                className="rounded-[16px] border border-[var(--border)] bg-white/60 p-5"
                initial={false}
                whileHover={{ y: -3 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
              >
                <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">{item.title}</p>
                <p className="mt-6 text-sm font-bold leading-6 text-[var(--muted-strong)]">{item.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
