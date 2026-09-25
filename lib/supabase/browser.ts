"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfigured } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey || !supabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }
  return createBrowserClient(url, anonKey);
}
