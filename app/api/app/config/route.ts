import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * The public Supabase address and anon key, which the website already ships in its
 * own scripts. The iPhone app reads them here so nothing is baked into the build.
 * Never add a secret to this response.
 */
export async function GET() {
  return NextResponse.json(
    { supabaseUrl: requireEnv("NEXT_PUBLIC_SUPABASE_URL"), supabaseAnonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
