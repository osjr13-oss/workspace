"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { removeEmDashes } from "@/lib/text";

const MAX = 3_000;

/** What Selrano should keep in mind in every chat that belongs to this project. */
export function ProjectInstructions({ projectId, initial }: { projectId: string; initial: string }) {
  const toast = useToast();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = value.trim() !== saved.trim();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const next = removeEmDashes(value).trim().slice(0, MAX);
    const { error: saveError } = await createSupabaseBrowserClient()
      .from("projects")
      .update({ instructions: next || null, updated_at: new Date().toISOString() })
      .eq("id", projectId);
    setSaving(false);
    if (saveError) return setError("Could not save. Please try again.");
    setSaved(next);
    setValue(next);
    toast({ title: "Project instructions saved" });
  }

  return (
    <form onSubmit={save} className="panel space-y-3 p-5" aria-labelledby="project-instructions-title">
      <div>
        <h2 id="project-instructions-title" className="text-[15px] font-semibold">
          Instructions
        </h2>
        <p className="mt-1 text-sm text-[var(--muted-strong)]">Selrano follows these in every chat in this project.</p>
      </div>
      <label htmlFor="project-instructions" className="sr-only">
        Project instructions
      </label>
      <textarea
        id="project-instructions"
        className="input-premium min-h-24 w-full resize-y px-4 py-3"
        value={value}
        maxLength={MAX}
        onChange={(event) => setValue(event.target.value)}
        placeholder="For example: This is about buying our first home. Budget is $450k, we need two bedrooms and a short commute to Midtown."
      />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary btn-sm" disabled={saving || !dirty}>
          {saving ? "Saving" : "Save instructions"}
        </button>
        {error ? <p className="text-sm font-semibold text-[var(--critical)]">{error}</p> : null}
      </div>
    </form>
  );
}
