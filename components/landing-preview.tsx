"use client";

import { useEffect, useState } from "react";
import { Sparkles, ArrowRight, CheckCircle2, Compass, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSpotlight } from "@/components/use-spotlight";

interface Scenario {
  id: string;
  tabLabel: string;
  userPrompt: string;
  thinkingNote: string;
  responseHeadline: string;
  responseBullets: string[];
  takeaway: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: "explore",
    tabLabel: "Explore an idea",
    userPrompt: "I want to build a quiet workspace app for people who hate messy dashboards, but I don't know where to draw the boundary.",
    thinkingNote: "Structuring core boundary",
    responseHeadline: "Start with one unit of work: the open thought.",
    responseBullets: [
      "Keep files and notes as supporting context, not the front door.",
      "Make the thinking canvas uncluttered so starting requires zero setup.",
      "Let structure emerge gradually rather than forcing folder taxonomy on day one."
    ],
    takeaway: "The real product is clarity, not document count."
  },
  {
    id: "tradeoffs",
    tabLabel: "Weigh trade-offs",
    userPrompt: "Should we build our own custom model weights or specialize through prompt synthesis and real-time retrieval?",
    thinkingNote: "Analyzing speed, costs, and flexibility",
    responseHeadline: "Specialized context delivery wins for your stage.",
    responseBullets: [
      "Custom weights lock you into high training cycles before product market fit.",
      "Deep workspace retrieval and style profiles give 90% of the personalization with instant iteration.",
      "You can always distill into private weights once usage patterns stabilize."
    ],
    takeaway: "Stay nimble on retrieval while proving user retention."
  },
  {
    id: "blindspots",
    tabLabel: "Find blind spots",
    userPrompt: "Here is our launch plan: ship everything at once to all users with a big announcement.",
    thinkingNote: "Stress-testing launch assumptions",
    responseHeadline: "Big bang releases create three avoidable risks:",
    responseBullets: [
      "Customer support spikes when unguided users hit edge cases together.",
      "You cannot isolate which specific feature drove retention or churn.",
      "A quiet cohort preview lets you refine the first 5 minutes of onboarding."
    ],
    takeaway: "Release to a 50 user circle first to observe where they hesitate."
  }
];

export function LandingPreview() {
  const { spotlightProps } = useSpotlight<HTMLDivElement>();
  const [activeId, setActiveId] = useState<string>("explore");
  const [isSimulating, setIsSimulating] = useState(false);

  const scenario = SCENARIOS.find((s) => s.id === activeId) || SCENARIOS[0];

  function handleSelect(id: string) {
    if (id === activeId) return;
    setIsSimulating(true);
    setActiveId(id);
    setTimeout(() => {
      setIsSimulating(false);
    }, 450);
  }

  return (
    <div
      id="workspace"
      className="panel spotlight overflow-hidden p-3 sm:p-5"
      style={{
        ...spotlightProps.style,
        ["--spot-size" as string]: "420px",
      }}
      ref={spotlightProps.ref}
      onMouseMove={spotlightProps.onMouseMove}
      onMouseEnter={spotlightProps.onMouseEnter}
      onMouseLeave={spotlightProps.onMouseLeave}
      data-active={spotlightProps["data-active"]}
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background-elevated)] p-4 sm:p-7 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
            </span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted-strong)]">
              Lumen 1 Interactive Preview
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <Sparkles size={13} className="text-amber-600" />
            <span>Click a scenario to watch it think</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SCENARIOS.map((item) => {
            const isSelected = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`relative rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  isSelected
                    ? "bg-[var(--text)] text-white shadow-xs"
                    : "border border-[var(--border)] bg-white/70 text-[var(--muted-strong)] hover:border-[var(--border-strong)] hover:bg-white"
                }`}
              >
                {item.tabLabel}
              </button>
            );
          })}
        </div>

        <div className="mt-6 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={scenario.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <div className="flex justify-end">
                <div className="max-w-[90%] sm:max-w-[80%] rounded-2xl border border-[var(--border)] bg-white/90 p-4 sm:p-5 shadow-2xs">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">You</p>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--text)]">
                    {scenario.userPrompt}
                  </p>
                </div>
              </div>

              {isSimulating ? (
                <div className="flex items-center gap-2 py-3 text-xs font-bold text-[var(--muted)]">
                  <div className="h-2 w-2 animate-ping rounded-full bg-amber-500" />
                  <span>Lumen 1 is reasoning...</span>
                </div>
              ) : (
                <div className="relative rounded-2xl border border-amber-500/20 bg-gradient-to-b from-white/95 to-amber-500/[0.03] p-5 sm:p-6 shadow-xs">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                      Lumen 1
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {scenario.thinkingNote}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-[var(--text)] sm:text-lg">
                    {scenario.responseHeadline}
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--muted-strong)]">
                    {scenario.responseBullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-amber-600" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 rounded-xl border border-[var(--border)] bg-white/80 p-3 text-xs font-semibold text-[var(--muted-strong)]">
                    <span className="font-bold text-[var(--text)]">Core takeaway: </span>
                    {scenario.takeaway}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <div className="flex items-center gap-4 text-xs font-semibold text-[var(--muted)]">
            <span className="flex items-center gap-1.5">
              <Compass size={14} className="text-stone-700" />
              Directional recaps
            </span>
            <span className="flex items-center gap-1.5">
              <Layers size={14} className="text-stone-700" />
              Grounded sources
            </span>
          </div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text)] hover:underline"
          >
            <span>Try it with your own thought</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
