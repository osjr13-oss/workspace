"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { brand } from "@/lib/brand";

type AddPublicDeckButtonProps = {
  slug: string;
  deckName: string;
  isAuthenticated: boolean;
  autoAdd?: boolean;
};

export function AddPublicDeckButton({
  slug,
  deckName,
  isAuthenticated,
  autoAdd = false
}: AddPublicDeckButtonProps) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const autoStarted = useRef(false);

  const returnPath = `/d/${slug}?add=1`;
  const signupHref = `/signup?next=${encodeURIComponent(returnPath)}`;
  const signinHref = `/signin?next=${encodeURIComponent(returnPath)}`;

  async function cloneDeck() {
    setWorking(true);
    setError("");
    try {
      const res = await fetch("/api/flashcard-decks/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug })
      });
      const payload = await res.json();
      if (res.status === 409 && payload.code === "own_deck") {
        router.replace(`/flashcards?deck=${payload.deckId || ""}`);
        return;
      }
      if (!res.ok) {
        setError(payload.error || "Could not add this deck to your workspace.");
        return;
      }
      const deckId = payload.deck?.id as string | undefined;
      router.replace(deckId ? `/flashcards?deck=${deckId}` : "/flashcards");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    if (!autoAdd || !isAuthenticated || autoStarted.current) return;
    autoStarted.current = true;
    void cloneDeck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdd, isAuthenticated]);

  return (
    <div className="glass-card mt-12 flex flex-col gap-4 p-7">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-extrabold">
            <Image src="/logo.svg" alt="" width={16} height={16} /> Made with {brand.name}
          </p>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted-strong)]">
            {isAuthenticated
              ? `Add “${deckName}” to your workspace so you can practice and review it anytime.`
              : `Upload your notes and get flashcards like this in seconds, or save “${deckName}” to your own workspace.`}
          </p>
        </div>
        {isAuthenticated ? (
          <button type="button" onClick={cloneDeck} className="btn-primary shrink-0" disabled={working}>
            <FolderPlus size={16} />
            {working ? "Adding…" : "Add to my workspace"}
          </button>
        ) : (
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link href={signupHref} className="btn-primary">
              Sign up to save this deck
            </Link>
            <Link href={signinHref} className="btn-secondary">
              Sign in
            </Link>
          </div>
        )}
      </div>
      {error ? (
        <p className="text-sm font-bold text-[var(--critical)]">
          {error}{" "}
          {error.toLowerCase().includes("upgrade") ? (
            <Link href="/settings" className="underline">
              Open Settings
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
