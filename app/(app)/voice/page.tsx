"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, Brain, CheckCircle2, Loader2 } from "lucide-react";
import { VoiceRecorder } from "@/components/voice-recorder";
import { WorkspaceHeader } from "@/components/workspace-header";
import { fetchJsonWithTimeout, pollTranscriptionStatus } from "@/lib/client-fetch";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Project } from "@/lib/types";

type PipelineStep = "idle" | "uploading" | "transcribing" | "structuring" | "complete" | "error";

export default function VoicePage() {
  return (
    <Suspense>
      <VoiceContent />
    </Suspense>
  );
}

function VoiceContent() {
  const searchParams = useSearchParams();
  const projectFilter = searchParams.get("project");

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(projectFilter || "");
  const [step, setStep] = useState<PipelineStep>("idle");
  const [message, setMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [transcriptionPreview, setTranscriptionPreview] = useState("");
  const [result, setResult] = useState<{
    noteId: string;
    noteTitle: string;
    deckId: string | null;
    deckName?: string;
    cardCount: number;
    warning?: string;
  } | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("projects")
      .select("*")
      .order("name")
      .then(({ data }) => setProjects((data as Project[]) || []));
    if (projectFilter) setProjectId(projectFilter);
  }, [projectFilter]);

  useEffect(() => {
    if (step !== "transcribing" && step !== "structuring" && step !== "uploading") {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(tick);
  }, [step]);

  async function handleRecording(blob: Blob, mimeType: string, durationSeconds: number) {
    setStep("uploading");
    setMessage("Uploading your recording…");
    setResult(null);
    setTranscriptionPreview("");

    const form = new FormData();
    form.append("audio", blob, mimeType.includes("mp4") ? "recording.mp4" : "recording.webm");
    form.append("projectId", projectId);
    form.append("durationSeconds", String(durationSeconds));

    const upload = await fetchJsonWithTimeout<{ sessionId?: string; status?: string; error?: string }>(
      "/api/ai/transcribe",
      { method: "POST", body: form, timeoutMs: 120_000 }
    );

    if (!upload.ok || !upload.data?.sessionId) {
      setStep("error");
      setMessage(upload.error || upload.data?.error || "Upload failed.");
      return;
    }

    setStep("transcribing");
    setMessage("Transcribing with Groq Whisper…");

    const poll = await pollTranscriptionStatus(upload.data.sessionId);
    if (!poll.ok) {
      setStep("error");
      setMessage(poll.error);
      return;
    }

    setTranscriptionPreview(poll.transcription);
    setStep("structuring");
    setMessage("Turning your voice into notes and flashcards…");

    const transform = await fetchJsonWithTimeout<{
      noteId: string;
      noteTitle: string;
      deckId: string | null;
      deckName?: string;
      cardCount: number;
      warning?: string;
      error?: string;
    }>("/api/ai/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voiceSessionId: upload.data.sessionId,
        projectId: projectId || null
      }),
      timeoutMs: 300_000
    });

    if (!transform.ok || !transform.data?.noteId) {
      setStep("error");
      setMessage(transform.error || transform.data?.error || "Could not build study materials.");
      return;
    }

    setResult(transform.data);
    setStep("complete");
    setMessage(
      transform.data.warning
        ? transform.data.warning
        : `Created ${transform.data.cardCount} flashcards from your voice note.`
    );
  }

  const busy = step === "uploading" || step === "transcribing" || step === "structuring";

  return (
    <div className="mx-auto max-w-4xl space-y-7 px-5 py-8 sm:px-6 lg:py-10">
      <WorkspaceHeader title="Voice study" eyebrow="Record → Notes → Flashcards">
        <span className="status-pill">Beta on staging</span>
      </WorkspaceHeader>

      <p className="text-sm leading-7 text-[var(--muted-strong)]">
        Record a messy lecture recap or voice note. Selrano transcribes it, structures clean markdown notes, and
        generates a spaced repetition deck automatically.
      </p>
      <p className="text-xs leading-6 text-[var(--muted)]">
        Tip: clips under 2 minutes process fastest on mobile. Longer lectures are supported but may take several
        minutes — the status will update automatically.
      </p>

      <div className="panel grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <label htmlFor="voice-project" className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">
            Project (optional)
          </label>
          <select
            id="voice-project"
            className="input-premium mt-2 w-full px-5"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            disabled={busy}
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <Link href="/projects" className="btn-secondary mt-6 sm:mt-0">
          Manage projects
        </Link>
      </div>

      <VoiceRecorder disabled={busy} onRecordingComplete={handleRecording} />

      {busy ? (
        <div className="panel space-y-2 p-5">
          <div className="flex items-center gap-3 text-sm font-bold text-[var(--muted-strong)]">
            <Loader2 size={18} className="animate-spin" />
            {message}
          </div>
          {elapsed > 0 ? (
            <p className="text-xs text-[var(--muted)]">
              Elapsed: {elapsed}s
              {step === "transcribing" && elapsed > 30 ? " — long recordings can take 1–3 minutes" : null}
            </p>
          ) : null}
        </div>
      ) : null}

      {step === "error" ? (
        <div className="panel p-5 text-sm font-bold text-[var(--critical)]">{message}</div>
      ) : null}

      {transcriptionPreview && step !== "idle" ? (
        <section className="panel p-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-[var(--muted)]">Raw transcription</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--muted-strong)]">{transcriptionPreview}</p>
        </section>
      ) : null}

      {step === "complete" && result ? (
        <section className="panel space-y-5 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={22} className="mt-0.5 text-[var(--low)]" />
            <div>
              <h2 className="text-lg font-extrabold tracking-[-0.02em]">Study materials ready</h2>
              <p className="mt-1 text-sm text-[var(--muted-strong)]">{message}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/notes" className="btn-primary">
              <BookOpen size={18} />
              Open notes
            </Link>
            {result.deckId ? (
              <Link href="/flashcards" className="btn-secondary">
                <Brain size={18} />
                View deck ({result.cardCount} cards)
              </Link>
            ) : null}
            <Link href="/study" className="btn-secondary">
              Start studying
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
