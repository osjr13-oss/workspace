/**
 * Central feature flags.
 *
 * Every new user-facing feature ships to production switched OFF by default, so
 * code can be deployed and tested quietly, then revealed on launch day by
 * setting the matching environment variable to "true" in Vercel and redeploying.
 *
 * Flags use the NEXT_PUBLIC_ prefix so the same value is available on both the
 * server (API routes) and the browser (React pages) from a single switch.
 *
 * To turn a feature ON: Vercel → Settings → Environment Variables → set the
 * variable to `true` for Production → redeploy. To turn it OFF again, set it to
 * `false` (or delete it) and redeploy.
 */
function flag(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

export const features = {
  /** Let chat take actions — search the workspace, create notes, make flashcard decks. */
  aiActions: flag(process.env.NEXT_PUBLIC_FEATURE_AI_ACTIONS),
  /** Full-text (keyword) search over uploaded files — free, no embedding API needed. */
  hybridSearch: flag(process.env.NEXT_PUBLIC_FEATURE_HYBRID_SEARCH)
};

export type FeatureName = keyof typeof features;
