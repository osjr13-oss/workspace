"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

type VoiceRecorderProps = {
  disabled?: boolean;
  onRecordingComplete: (blob: Blob, mimeType: string, durationSeconds: number) => void;
};

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function VoiceRecorder({ disabled, onRecordingComplete }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(Array(24).fill(0.08));
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      stopVisualizer();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function stopVisualizer() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
  }

  function startVisualizer(stream: MediaStream) {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const bars = Array.from({ length: 24 }, (_, index) => {
        const sample = data[Math.floor((index / 24) * data.length)] || 0;
        return Math.max(0.08, sample / 255);
      });
      setLevels(bars);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        onRecordingComplete(blob, mimeType, durationSeconds);
        stream.getTracks().forEach((track) => track.stop());
        stopVisualizer();
      };

      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start(250);
      setRecording(true);
      setElapsed(0);
      startVisualizer(stream);
      timerRef.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(seconds);
        if (seconds >= 600) stopRecording();
      }, 250);
    } catch {
      setError("Microphone access is required to record. Check browser permissions.");
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="panel p-8 text-center sm:p-10">
      <div className="mx-auto flex h-28 max-w-md items-end justify-center gap-1.5">
        {levels.map((level, index) => (
          <span
            key={index}
            className="w-2 rounded-full bg-[var(--text)] transition-[height] duration-100"
            style={{ height: `${Math.round(12 + level * 72)}px`, opacity: recording ? 0.9 : 0.25 }}
          />
        ))}
      </div>

      <p className="mt-6 font-mono text-3xl font-extrabold tracking-tight">{formatTimer(elapsed)}</p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {recording
          ? elapsed >= 180
            ? "Long recording — processing may take a few minutes after you stop"
            : "Listening… tap stop when you are done"
          : "Tap the mic and talk through a lecture or study idea"}
      </p>

      <div className="mt-8 flex justify-center">
        {recording ? (
          <button type="button" onClick={stopRecording} className="btn-primary min-h-14 min-w-14 rounded-full px-0" disabled={disabled}>
            <Square size={22} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            className="btn-primary min-h-16 min-w-16 rounded-full px-0 shadow-[var(--shadow-soft)]"
            disabled={disabled}
            aria-label="Start recording"
          >
            <Mic size={28} />
          </button>
        )}
      </div>

      {error ? <p className="mt-4 text-sm font-bold text-[var(--critical)]">{error}</p> : null}
    </div>
  );
}
