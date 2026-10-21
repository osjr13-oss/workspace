import type { SupabaseClient } from "@supabase/supabase-js";
import type { Citation } from "@/lib/types";

/**
 * Tools the chat AI can invoke.
 *
 * Every tool runs through the caller's authenticated Supabase client, so row-level
 * security guarantees a user can only ever read or write their own data.
 */
export const toolDefinitions: Array<{
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> = [];

export type ToolContext = {
  supabase: SupabaseClient;
  userId: string;
  // Web research citations keep numbered markers unique across a turn.
  webCitations: Record<string, Citation>;
};

/** Run a single tool call and return a short text result for the model to read. */
export async function executeTool(name: string, _args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  switch (name) {
    case "web_search":
      return "Web research must run through the checked research flow. No search was performed.";
    default:
      return `Unknown tool: ${name}`;
  }
}
