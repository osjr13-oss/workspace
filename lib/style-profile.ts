import type { SupabaseClient } from "@supabase/supabase-js";

type StyleDimensions = {
  averageWords: number;
  questionRate: number;
  exclamationRate: number;
  listRate: number;
  lowercaseRate: number;
  sampleCount: number;
};

export type StyleProfile = {
  styleDirective: string;
  confidence: number;
  messageCount: number;
};

const DEFAULT_DIMENSIONS: StyleDimensions = {
  averageWords: 12,
  questionRate: 0,
  exclamationRate: 0,
  listRate: 0,
  lowercaseRate: 0,
  sampleCount: 0
};

function signals(message: string): Omit<StyleDimensions, "sampleCount"> {
  const trimmed = message.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  const letters = [...trimmed].filter((character) => /[a-z]/i.test(character));
  const lowercase = letters.filter((character) => character === character.toLowerCase()).length;

  return {
    averageWords: words.length,
    questionRate: trimmed.includes("?") ? 1 : 0,
    exclamationRate: trimmed.includes("!") ? 1 : 0,
    listRate: lines.some((line) => /^\s*(?:[-*]|\d+[.)])\s/.test(line)) ? 1 : 0,
    lowercaseRate: letters.length ? lowercase / letters.length : 0
  };
}

function mergeDimensions(current: StyleDimensions, next: ReturnType<typeof signals>): StyleDimensions {
  const sampleCount = current.sampleCount + 1;
  const weight = Math.min(0.35, 1 / sampleCount);
  return {
    averageWords: current.averageWords * (1 - weight) + next.averageWords * weight,
    questionRate: current.questionRate * (1 - weight) + next.questionRate * weight,
    exclamationRate: current.exclamationRate * (1 - weight) + next.exclamationRate * weight,
    listRate: current.listRate * (1 - weight) + next.listRate * weight,
    lowercaseRate: current.lowercaseRate * (1 - weight) + next.lowercaseRate * weight,
    sampleCount
  };
}

function directiveFromDimensions(dimensions: StyleDimensions) {
  const length =
    dimensions.averageWords < 9
      ? "Use clear, conversational sentences. Keep casual exchanges compact, but give substantive questions the detail they need."
      : dimensions.averageWords > 24
        ? "Use developed sentences and preserve nuance."
        : "Use concise, conversational sentences.";
  const structure =
    dimensions.listRate > 0.35
      ? "Use clean lists when they make the answer easier to scan."
      : "Prefer connected prose unless a list is clearly useful.";
  const energy =
    dimensions.exclamationRate > 0.25
      ? "A little visible enthusiasm is welcome."
      : "Keep the tone calm and avoid forced enthusiasm.";
  const casing =
    dimensions.lowercaseRate > 0.94
      ? "Use a relaxed, natural tone with readable sentence casing; do not imitate typos."
      : "Use standard sentence casing.";

  return `${length} ${structure} ${energy} ${casing} Never use an em dash.`;
}

export async function ingestUserStyle(
  supabase: SupabaseClient,
  userId: string,
  message: string
): Promise<StyleProfile | null> {
  try {
    const { data } = await supabase
      .from("style_profiles")
      .select("dimensions, message_count")
      .eq("user_id", userId)
      .maybeSingle();

    const current = {
      ...DEFAULT_DIMENSIONS,
      ...((data?.dimensions as Partial<StyleDimensions> | null) || {})
    };
    const dimensions = mergeDimensions(current, signals(message));
    const messageCount = Number(data?.message_count || 0) + 1;
    const confidence = Math.min(1, messageCount / 20);
    const styleDirective = directiveFromDimensions(dimensions);

    // The reply only needs the directive, so the write is not awaited.
    void supabase
      .from("style_profiles")
      .upsert({
        user_id: userId,
        dimensions,
        style_directive: styleDirective,
        confidence,
        message_count: messageCount,
        updated_at: new Date().toISOString()
      })
      .then(
        () => undefined,
        () => undefined
      );

    return { styleDirective, confidence, messageCount };
  } catch {
    return null;
  }
}
