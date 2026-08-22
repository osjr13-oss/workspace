"use client";

import { useState } from "react";
import { ArrowRight, Brain, Globe, RotateCcw, Sparkles } from "lucide-react";
import { removeEmDashes } from "@/lib/text";

type DemoConversation = {
  userPrompt: string;
  recalledMemory: string;
  assistantReply: {
    intro: string;
    points: string[];
    sourceCitation?: string;
  };
};

const PRESET_DEMOS: Record<string, DemoConversation> = {
  decision: {
    userPrompt: "I am deciding between two job offers. One pays more but has a long commute, the other is remote with slightly lower base pay.",
    recalledMemory: "Recalled: You value having evenings free for creative writing and 4-day focus blocks",
    assistantReply: {
      intro: "Looking at both options alongside your goal to preserve creative writing energy in the evenings:",
      points: [
        "The commute on Option A will cost roughly 10-12 hours per week of discretionary time, directly cutting into your evening writing routines.",
        "Option B protects your daily schedule and gives you the location flexibility you prioritized last month.",
        "Consider negotiating Option B on signing bonus or performance equity to narrow the base compensation gap."
      ],
      sourceCitation: "Standard remote compensation ranges"
    }
  },
  priorities: {
    userPrompt: "Help me organize my priorities for this week. I feel scattered and have three different projects competing for attention.",
    recalledMemory: "Recalled: Goal to finish your personal website redesign by Sunday",
    assistantReply: {
      intro: "Let us cut through the noise and anchor on what moves the needle this week:",
      points: [
        "Dedicate your Tuesday and Thursday mornings to the website redesign while your energy is highest.",
        "Batch administrative and email tasks into a single 45-minute window after lunch.",
        "Park secondary ideas in a separate note so they stop pulling attention from your main objective."
      ]
    }
  },
  idea: {
    userPrompt: "I have an idea for a private audio journaling app that transcribes daily reflections. Help me talk it through.",
    recalledMemory: "Recalled: Preference for simple, calm tools over feature-bloated software",
    assistantReply: {
      intro: "Here is a clean way to frame this idea around genuine consumer value:",
      points: [
        "Focus entirely on frictionless capture: tap once to record, with zero categorization required up front.",
        "Use local-first storage or end-to-end privacy as the primary trust differentiator.",
        "Synthesize weekly patterns rather than demanding daily manual tagging."
      ]
    }
  }
};

export function LandingPreview() {
  const [selectedDemoKey, setSelectedDemoKey] = useState<string>("decision");
  const [customInput, setCustomInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [activeConversation, setActiveConversation] = useState<DemoConversation>(PRESET_DEMOS.decision);

  function handleSelectPreset(key: string) {
    if (key === selectedDemoKey && !customInput) return;
    setSelectedDemoKey(key);
    setIsThinking(true);
    setTimeout(() => {
      setActiveConversation(PRESET_DEMOS[key]);
      setIsThinking(false);
    }, 450);
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = removeEmDashes(customInput).trim();
    if (!clean) return;

    setIsThinking(true);
    setTimeout(() => {
      setActiveConversation({
        userPrompt: clean,
        recalledMemory: "Recalled: Your preferences for clear structure and calm daily focus",
        assistantReply: {
          intro: `Here is a grounded perspective on "${clean.slice(0, 48)}...":`,
          points: [
            "Break the core question down into what is immediately actionable versus what can wait.",
            "Test the main assumption before committing significant time or energy.",
            "Save key takeaways into your notes to revisit next week."
          ]
        }
      });
      setCustomInput("");
      setIsThinking(false);
    }, 550);
  }

  function handleReset() {
    setSelectedDemoKey("decision");
    setActiveConversation(PRESET_DEMOS.decision);
    setCustomInput("");
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/5">
      {/* App Window Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/70 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          </div>
          <span className="ml-2 font-mono text-[11px] font-semibold text-slate-400">
            selrano.com/chats
          </span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          title="Reset conversation demo"
          className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-700 transition"
        >
          <RotateCcw size={12} />
          <span>Reset</span>
        </button>
      </div>

      {/* Interactive Starter Chips */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-100 bg-slate-50/40 px-4 py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 self-center mr-1">
          Try a prompt:
        </span>
        <button
          type="button"
          onClick={() => handleSelectPreset("decision")}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
            selectedDemoKey === "decision" && !customInput
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
          }`}
        >
          Weighing a decision
        </button>
        <button
          type="button"
          onClick={() => handleSelectPreset("priorities")}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
            selectedDemoKey === "priorities" && !customInput
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
          }`}
        >
          Planning my week
        </button>
        <button
          type="button"
          onClick={() => handleSelectPreset("idea")}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
            selectedDemoKey === "idea" && !customInput
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
          }`}
        >
          Exploring an idea
        </button>
      </div>

      {/* Interactive Chat Canvas */}
      <div className="p-5 sm:p-7 space-y-5">
        {/* User Message */}
        <div className="flex justify-end">
          <div className="max-w-[90%] rounded-2xl border border-slate-200 bg-slate-100/90 px-4 py-3 text-xs sm:text-sm font-medium text-slate-900 shadow-xs leading-relaxed">
            {activeConversation.userPrompt}
          </div>
        </div>

        {/* Assistant Response with Grounded Tools & Durable Memory */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white">
              <Brain size={13} />
            </div>
            <span className="text-xs font-bold text-slate-900">Selrano</span>
            <span className="text-[10px] text-slate-400 font-medium">
              {activeConversation.recalledMemory}
            </span>
          </div>

          {isThinking ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500 animate-pulse">
              <Sparkles size={14} className="animate-spin text-slate-400" />
              <span>Synthesizing durable memory and context...</span>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-xs sm:text-sm leading-relaxed text-slate-700 space-y-2">
              <p className="font-medium text-slate-800">
                {activeConversation.assistantReply.intro}
              </p>
              <ul className="list-disc pl-4 space-y-1.5 text-slate-600">
                {activeConversation.assistantReply.points.map((point, index) => (
                  <li key={index}>
                    {point}
                    {index === 0 && activeConversation.assistantReply.sourceCitation && (
                      <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.2 text-[9px] font-bold text-blue-700">
                        <Globe size={9} /> [1]
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Interactive Floating Composer */}
        <form onSubmit={handleCustomSubmit} className="rounded-xl border border-slate-200 bg-white p-1.5 flex items-center gap-2 shadow-xs">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Type your own question to see Selrano respond..."
            className="flex-1 px-3 py-1 text-xs text-slate-900 outline-none placeholder:text-slate-400 bg-transparent"
          />
          <button
            type="submit"
            disabled={!customInput.trim() || isThinking}
            aria-label="Send question"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-black transition disabled:opacity-40 shrink-0"
          >
            <ArrowRight size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
