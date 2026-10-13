import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isAllowedEmail } from "@/lib/access";
import { requireEnv } from "@/lib/env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
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
            // Server components cannot always write cookies; route handlers can.
          }
        }
      }
    }
  );
}

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  // Selrano is private: an account that is not on the allowlist is treated as signed out.
  if (error || !user || !isAllowedEmail(user.email)) {
    return { supabase, user: null };
  }

  return { supabase, user };
}
