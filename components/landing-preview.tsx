"use client";

import { useState } from "react";
import { ArrowRight, BookOpen, BrainCircuit, FileText, Folder, MessageSquare, Plus, RotateCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSpotlight } from "@/components/use-spotlight";

type NavTab = "Chats" | "Workspace" | "Projects" | "Files" | "Notes" | "Flashcards";

const NAV_ITEMS: NavTab[] = ["Chats", "Workspace", "Projects", "Files", "Notes", "Flashcards"];

export function LandingPreview() {
  const { spotlightProps } = useSpotlight<HTMLDivElement>();
  const [activeTab, setActiveTab] = useState<NavTab>("Chats");
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);

  const flashcards = [
    { front: "What is Selrano's primary focus?", back: "A calm AI workspace for your materials, grounded chat, notes, and study review." },
    { front: "How does context grounding work?", back: " Selrano uses your uploaded files and notes without mixing up sources or hallucinating facts." },
    { front: "What happens to learned style preferences?", back: "Selrano adapts to your communication voice over time across conversation history." }
  ];

  return (
    <div
      id="workspace"
      className="panel spotlight overflow-hidden p-3 sm:p-4"
      style={{
        ...spotlightProps.style,
        ["--spot-size" as string]: "360px"
      }}
      ref={spotlightProps.ref}
      onMouseMove={spotlightProps.onMouseMove}
      onMouseEnter={spotlightProps.onMouseEnter}
      onMouseLeave={spotlightProps.onMouseLeave}
      data-active={spotlightProps["data-active"]}
    >
      {/* Mobile nav tab selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 sm:hidden border-b border-[var(--border)] mb-3">
        {NAV_ITEMS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-colors ${
              activeTab === tab
                ? "bg-[var(--text)] text-[var(--background-elevated)]"
                : "bg-[var(--surface-subtle)] text-[var(--muted)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid min-h-[520px] grid-cols-1 overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--background-elevated)] sm:grid-cols-[190px_1fr]">
        {/* Desktop Sidebar */}
        <aside className="border-r border-[var(--border)] p-4 hidden sm:block">
          <div className="space-y-1">
            {NAV_ITEMS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`relative flex w-full items-center justify-between rounded-2xl px-3.5 py-3 text-left text-sm font-bold transition-colors duration-150 ${
                    isActive ? "text-[var(--text)] font-extrabold" : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-0 rounded-2xl bg-[var(--surface-subtle)]"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{tab}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Dynamic Main Workspace Pane */}
        <div className="p-5 sm:p-8 flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex-1"
            >
              {activeTab === "Chats" && (
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Active Thread</p>
                    <span className="status-pill text-xs">Grounded Context</span>
                  </div>
                  <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">
                    Biology 101: Cellular Respiration
                  </h2>
                  <div className="mt-6 space-y-4">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-xs sm:text-sm font-bold text-[var(--text)]">
                      User: Can you summarize how ATP synthesis occurs according to my lecture notes?
                    </div>
                    <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-strong)] p-4 text-xs sm:text-sm leading-relaxed text-[var(--muted-strong)]">
                      <p className="font-extrabold text-[var(--text)] mb-2">Selrano Assistant</p>
                      ATP synthesis occurs in the inner mitochondrial membrane via oxidative phosphorylation. Protons pumped across the membrane create a gradient that drives ATP synthase.
                      <div className="mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-2 text-xs font-bold text-[var(--muted)]">
                        <span>Source: lecture_notes_ch4.pdf (p. 14)</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value="Ask a follow up or create flashcards from this chat..."
                      className="input-premium flex-1 text-xs px-4 text-[var(--muted)]"
                    />
                    <button type="button" onClick={() => setActiveTab("Flashcards")} className="btn-primary text-xs px-4">
                      Create cards
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "Workspace" && (
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">New conversation</p>
                  <h2 className="mt-6 text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">Think out loud with Selrano.</h2>
                  <p className="mt-2 text-sm text-[var(--muted-strong)]">Start anywhere. Add a project when your own material should guide the answer.</p>

                  <div
                    onClick={() => setActiveTab("Chats")}
                    className="panel mt-8 flex cursor-pointer items-center justify-between p-5 transition-transform hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-4">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--surface-subtle)]">
                        <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-[var(--muted-strong)]">CTX</span>
                      </span>
                      <div>
                        <p className="font-extrabold text-sm sm:text-base text-[var(--text)]">Your context, when it matters</p>
                        <p className="text-xs sm:text-sm text-[var(--muted-strong)]">Use notes, files, and live sources without mixing them up.</p>
                      </div>
                    </div>
                    <ArrowRight size={20} className="shrink-0 text-[var(--muted)]" />
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div onClick={() => setActiveTab("Chats")} className="cursor-pointer rounded-[16px] border border-[var(--border)] bg-white/60 p-5 hover:border-[var(--border-strong)] transition-colors">
                      <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Style</p>
                      <p className="mt-4 text-sm font-bold leading-6 text-[var(--muted-strong)]">Direct, concise, and shaped around how you communicate.</p>
                    </div>
                    <div onClick={() => setActiveTab("Projects")} className="cursor-pointer rounded-[16px] border border-[var(--border)] bg-white/60 p-5 hover:border-[var(--border-strong)] transition-colors">
                      <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Memory</p>
                      <p className="mt-4 text-sm font-bold leading-6 text-[var(--muted-strong)]">Useful preferences and ongoing work stay available.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "Projects" && (
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Projects Library</p>
                    <button type="button" onClick={() => setActiveTab("Workspace")} className="btn-secondary text-xs h-8 px-3">
                      <Plus size={14} /> New project
                    </button>
                  </div>
                  <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">Active Workspaces</h2>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {[
                      { title: "Biology 101 Coursework", files: "4 Files", notes: "12 Notes", updated: "2h ago" },
                      { title: "Product Strategy & Research", files: "8 Files", notes: "6 Notes", updated: "1d ago" },
                      { title: "Personal Finance & Taxes", files: "3 Files", notes: "5 Notes", updated: "3d ago" }
                    ].map((proj) => (
                      <div
                        key={proj.title}
                        onClick={() => setActiveTab("Files")}
                        className="glass-card cursor-pointer p-4 hover:border-[var(--border-strong)]"
                      >
                        <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--text)]">
                          <Folder size={16} className="text-[var(--muted)]" />
                          <span>{proj.title}</span>
                        </div>
                        <div className="mt-4 flex items-center justify-between text-xs font-bold text-[var(--muted)]">
                          <span>{proj.files} · {proj.notes}</span>
                          <span>{proj.updated}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "Files" && (
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Source Materials</p>
                  <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">Uploaded Files</h2>
                  <div className="mt-6 space-y-2">
                    {[
                      { name: "biology_lecture_notes_ch4.pdf", size: "2.4 MB", status: "Extracted", type: "PDF" },
                      { name: "q3_market_analysis.docx", size: "1.1 MB", status: "Extracted", type: "DOCX" },
                      { name: "experiment_data_sheet.csv", size: "450 KB", status: "Extracted", type: "CSV" }
                    ].map((file) => (
                      <div
                        key={file.name}
                        onClick={() => setActiveTab("Chats")}
                        className="flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--border)] bg-white/70 p-4 hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FileText size={18} className="text-[var(--muted)]" />
                          <div>
                            <p className="text-xs sm:text-sm font-extrabold text-[var(--text)]">{file.name}</p>
                            <p className="text-xs text-[var(--muted)]">{file.size} · {file.type}</p>
                          </div>
                        </div>
                        <span className="status-pill text-xs">{file.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "Notes" && (
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Workspace Notes</p>
                  <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">Notes & Key Concepts</h2>
                  <div className="mt-6 space-y-3">
                    {[
                      { title: "Mitochondrial Function Overview", snippet: "Key takeaway: Electron transport chain establishes proton gradient necessary for ATP synthase activity." },
                      { title: "Q3 Competitive Breakdown", snippet: "Summary: Positioning strategy relies on grounded materials workspace rather than generic chat." }
                    ].map((note) => (
                      <div
                        key={note.title}
                        onClick={() => setActiveTab("Chats")}
                        className="glass-card cursor-pointer p-4 hover:border-[var(--border-strong)]"
                      >
                        <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--text)]">
                          <BookOpen size={16} className="text-[var(--muted)]" />
                          <span>{note.title}</span>
                        </div>
                        <p className="mt-2 text-xs text-[var(--muted-strong)] leading-relaxed">{note.snippet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "Flashcards" && (
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Study Review</p>
                    <span className="text-xs font-extrabold text-[var(--muted)]">
                      Card {flashcardIndex + 1} of {flashcards.length}
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.03em] sm:text-3xl">Flashcard Review</h2>

                  <div className="mt-6">
                    <div
                      onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                      className="glass-card min-h-[160px] cursor-pointer flex flex-col justify-between p-6 transition-all border border-[var(--border-strong)]"
                    >
                      <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                        {flashcardFlipped ? "Answer" : "Question (Click to flip)"}
                      </span>
                      <p className="mt-4 text-base font-extrabold text-[var(--text)] leading-relaxed">
                        {flashcardFlipped ? flashcards[flashcardIndex].back : flashcards[flashcardIndex].front}
                      </p>
                      <div className="mt-4 flex items-center justify-between text-xs font-bold text-[var(--muted)]">
                        <span className="flex items-center gap-1">
                          <RotateCw size={14} /> Tap to flip
                        </span>
                        <span>Click next below</span>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFlashcardFlipped(false);
                          setFlashcardIndex((prev) => (prev + 1) % flashcards.length);
                        }}
                        className="btn-primary text-xs px-4"
                      >
                        Next flashcard <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
