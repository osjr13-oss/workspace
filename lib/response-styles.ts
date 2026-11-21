/**
 * Response styles the owner can pick (Settings, or for one chat from the
 * composer). Each is one short instruction added to the prompt. "Write like
 * me" leans on the learned writing profile (lib/style-profile.ts) instead.
 */
export const RESPONSE_STYLES = [
  { id: "normal", label: "Normal", description: "Selrano's usual balance" },
  { id: "concise", label: "Concise", description: "Shorter answers, straight to the point" },
  { id: "explanatory", label: "Explanatory", description: "Teaches the why, step by step" },
  { id: "warm", label: "Warm", description: "Friendlier and more encouraging" },
  { id: "mine", label: "Write like me", description: "Matches how you write" }
] as const;

export type ResponseStyleId = (typeof RESPONSE_STYLES)[number]["id"];

const DIRECTIVES: Record<ResponseStyleId, string> = {
  normal: "",
  concise:
    "Response style: concise. Lead with the answer in the first sentence. Keep most replies to a few sentences; use a short list only for real steps. Skip background, caveats and recaps unless they change the answer.",
  explanatory:
    "Response style: explanatory. Explain the reasoning behind the answer the way a patient teacher would: build from what the user already knows, give one concrete example, and define any term they may not know. Stay focused on their question.",
  warm:
    "Response style: warm. Sound like a kind, encouraging friend who is also an expert: acknowledge how the user is feeling when it matters, and be generous with practical help. No flattery and no exclamation marks in every sentence.",
  mine:
    "Response style: write like the user. Match their usual length, vocabulary and punctuation as described in their learned communication preferences, while staying clear and correct."
};

export function isResponseStyle(value: unknown): value is ResponseStyleId {
  return typeof value === "string" && value in DIRECTIVES;
}

export function responseStyleDirective(value: unknown) {
  return isResponseStyle(value) ? DIRECTIVES[value] : "";
}
