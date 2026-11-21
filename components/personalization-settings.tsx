"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useToast } from "@/components/toast";
import { RESPONSE_STYLES, isResponseStyle, type ResponseStyleId } from "@/lib/response-styles";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { removeEmDashes } from "@/lib/text";

const MAX = 3_000;

/**
 * Custom instructions: what Selrano should know about the owner, how it should
 * answer, and the default response style. Sent with every chat message.
 */
export function PersonalizationSettings() {
  const toast = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [aboutYou, setAboutYou] = useState("");
  const [instructions, setInstructions] = useState("");
  const [style, setStyle] = useState<ResponseStyleId>("normal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      setAboutYou(String(profile?.about_you || ""));
      setInstructions(String(profile?.response_instructions || ""));
      if (isResponseStyle(profile?.response_style)) setStyle(profile.response_style);
    });
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) return;
    setSaving(true);
    setError("");
    const supabase = createSupabaseBrowserClient();
    const { error: saveError } = await supabase
      .from("profiles")
      .update({
        about_you: removeEmDashes(aboutYou).trim().slice(0, MAX) || null,
        response_instructions: removeEmDashes(instructions).trim().slice(0, MAX) || null,
        response_style: style,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);
    setSaving(false);
    if (saveError) setError("Could not save. Please try again.");
    else toast({ title: "Personalization saved", description: "Selrano uses it from your next message." });
  }

  return (
    <form onSubmit={save} className="panel space-y-5 p-6" aria-labelledby="personalization-title">
      <div>
        <h2 id="personalization-title" className="text-base font-semibold tracking-[-0.01em]">
          Personalization
        </h2>
        <p className="mt-1 text-sm text-[var(--muted-strong)]">Selrano reads this before every reply. You can change the style for one chat from the message box.</p>
      </div>
      <div>
        <label htmlFor="about-you" className="eyebrow text-[var(--muted)]">
          What should Selrano know about you?
        </label>
        <textarea
          id="about-you"
          className="input-premium mt-2 min-h-28 w-full resize-y px-4 py-3"
          value={aboutYou}
          maxLength={MAX}
          onChange={(event) => setAboutYou(event.target.value)}
          placeholder="For example: I live in Brooklyn, work in operations, and I'm training for a half marathon in April."
        />
      </div>
      <div>
        <label htmlFor="response-instructions" className="eyebrow text-[var(--muted)]">
          How should Selrano respond?
        </label>
        <textarea
          id="response-instructions"
          className="input-premium mt-2 min-h-28 w-full resize-y px-4 py-3"
          value={instructions}
          maxLength={MAX}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder="For example: Be direct. Give me the answer first, then the reasoning. Use dollars and miles."
        />
      </div>
      <div>
        <label htmlFor="response-style" className="eyebrow block text-[var(--muted)]">
          Default style
        </label>
        <select id="response-style" className="input-premium mt-2 w-full px-4 sm:w-[26rem]" value={style} onChange={(event) => setStyle(event.target.value as ResponseStyleId)}>
          {RESPONSE_STYLES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}: {option.description}
            </option>
          ))}
        </select>
      </div>
      <button className="btn-primary" type="submit" disabled={saving || !userId}>
        <Save size={18} />
        {saving ? "Saving" : "Save personalization"}
      </button>
      {error ? <p className="text-sm font-semibold text-[var(--critical)]">{error}</p> : null}
    </form>
  );
}
