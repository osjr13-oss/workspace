"use client";

import { useState } from "react";
import { ArrowUp, BookOpen, Check, Copy, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PromptScenario {
  id: string;
  pill: string;
  attachment: string;
  query: string;
  citation: string;
  response: string;
  actionTaken: string;
}

const SCENARIOS: PromptScenario[] = [
  {
    id: "architecture",
    pill: "Weigh architecture trade-offs",
    attachment: "Q3 Architecture RFC.pdf",
    query: "Compare our edge caching plan against regional replicas, referencing the Q3 RFC.",
    citation: "Q3 Architecture RFC.pdf (Page 4, Section 2.1)",
    response: "Looking at your RFC specs, edge caching cuts p99 latency by 42ms for global readers, but increases cache invalidation complexity across 18 points of presence. If your write frequency exceeds 100 updates per minute, regional replicas provide stronger consistency guarantees with fewer sync races.",
    actionTaken: "Saved to Notes",
  },
  {
    id: "strategy",
    pill: "Pressure-test launch strategy",
    attachment: "Launch Strategy Brief.md",
    query: "Where are the biggest distribution bottlenecks in our launch timeline?",
    citation: "Launch Strategy Brief.md (Milestones)",
    response: "The primary risk is the two-week gap between the closed beta feedback cutoff and public onboarding. If onboarding setup takes more than three steps, self-serve conversion will drop before users experience your adaptive style profiles.",
    actionTaken: "Added to Review Deck",
  },
  {
    id: "research",
    pill: "Extract synthesis from notes",
    attachment: "Customer Interviews.txt",
    query: "What recurring objection appeared across our ten user conversations?",
    citation: "Customer Interviews.txt (Interviews 3, 7, 9)",
    response: "Seven of ten users hesitated at complex onboarding menus. They wanted a single empty composer where they could start typing immediately, with model choices and source attachments available in the bottom toolbar when needed.",
    actionTaken: "Synthesized into Notes",
  },
];

export function LandingPreview() {
  const [activeId, setActiveId] = useState<string>("architecture");
  const [copied, setCopied] = useState(false);

  const scenario = SCENARIOS.find((s) => s.id === activeId) ?? SCENARIOS[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(scenario.response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative mx-auto w-full max-w-4xl">
      {/* Outer ambient glow */}
      <div
        className="pointer-events-none absolute -inset-4 rounded-[32px] opacity-40 blur-2xl transition-opacity duration-500"
        style={{
          background: "radial-gradient(ellipse at center, rgba(140, 155, 240, 0.25) 0%, rgba(20, 22, 35, 0) 70%)",
        }}
      />

      {/* Main product window */}
      <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-[#11121a]/95 text-white shadow-2xl backdrop-blur-2xl">
        {/* Subtle window chrome */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="ml-2 text-xs font-medium text-white/40 tracking-tight">selrano.com/chats</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-white/70">
              Selrano 1
            </span>
          </div>
        </div>

        {/* Content area */}
        <div className="p-5 sm:p-7 space-y-6">
          {/* Scenario selector chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/40 font-medium mr-1 hidden sm:inline">Try scenario:</span>
            {SCENARIOS.map((item) => {
              const isSelected = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-white text-black shadow-sm"
                      : "bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white"
                  }`}
                >
                  {item.pill}
                </button>
              );
            })}
          </div>

          {/* Composer Capsule */}
          <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4 shadow-inner transition-all">
            <AnimatePresence mode="wait">
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.18 }}
                className="text-sm sm:text-base font-normal text-white/90 leading-relaxed min-h-[44px]"
              >
                {scenario.query}
              </motion.div>
            </AnimatePresence>

            {/* Bottom Toolbar inside capsule */}
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.08] pt-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/80 font-medium">
                  <FileText size={12} className="text-white/60" />
                  <span className="truncate max-w-[180px]">{scenario.attachment}</span>
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-xs font-medium text-white/60">Selrano 1</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black shadow-sm">
                  <ArrowUp size={14} strokeWidth={2.5} />
                </span>
              </div>
            </div>
          </div>

          {/* Assistant Response Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={scenario.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3"
            >
              {/* Citation badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-medium text-white/50">
                    Grounded in <span className="text-white/80 font-semibold">{scenario.citation}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] font-medium text-white/50 hover:text-white transition-colors"
                >
                  {copied ? (
                    <>
                      <Check size={12} className="text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Response body */}
              <p className="text-sm leading-relaxed text-white/85 font-normal">
                {scenario.response}
              </p>

              {/* Action summary */}
              <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
                <BookOpen size={12} className="text-white/40" />
                <span className="text-xs text-white/50 font-medium">
                  {scenario.actionTaken}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
