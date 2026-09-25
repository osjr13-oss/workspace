import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireEnv } from "@/lib/env";
import { supabaseConfigured } from "@/lib/supabase/config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components cannot always write cookies. Route handlers can.
        }
      }
    }
  });
}

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null };
  return { supabase, user };
}

export async function getOptionalUser() {
  if (!supabaseConfigured()) return { user: null };
  const { user } = await getAuthenticatedUser();
  return { user };
}
