export type UpgradeReason = "projects" | "decks" | "ai_limit" | "file_size" | "general";

const UPGRADE_REASONS: UpgradeReason[] = ["projects", "decks", "ai_limit", "file_size", "general"];

function isUpgradeReason(value: unknown): value is UpgradeReason {
  return typeof value === "string" && (UPGRADE_REASONS as string[]).includes(value);
}

type UpgradePayload = {
  reason?: unknown;
  code?: unknown;
  error?: unknown;
} | null | undefined;

/**
 * Detect whether an API response should open the upgrade modal, and why.
 * Prefers an explicit `reason` field, then falls back to plan_limit / 429 /
 * upgrade-oriented error copy.
 */
export function detectUpgradeReason(status: number, payload?: UpgradePayload): UpgradeReason | null {
  if (isUpgradeReason(payload?.reason)) return payload.reason;

  const errorText = String(payload?.error ?? "").toLowerCase();
  const looksLikeLimit =
    payload?.code === "plan_limit" ||
    status === 429 ||
    errorText.includes("upgrade") ||
    errorText.includes("daily ai limit");

  if (!looksLikeLimit) return null;

  if (errorText.includes("project")) return "projects";
  if (errorText.includes("deck")) return "decks";
  if (errorText.includes("file") || errorText.includes(" mb") || errorText.includes("mb ")) return "file_size";
  if (status === 429 || errorText.includes("daily ai") || errorText.includes("ai request")) return "ai_limit";
  return "general";
}
