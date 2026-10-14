import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
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

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * The iPhone app signs in with Supabase directly and sends its access token as
 * "Authorization: Bearer <token>". Queries then run as that user, under the
 * same row-level security as the website's cookie session.
 */
async function bearerClient(): Promise<{ supabase: ServerClient; token: string } | null> {
  const authorization = (await headers()).get("authorization") || "";
  const token = /^Bearer\s+(.+)$/i.exec(authorization)?.[1]?.trim();
  if (!token) return null;
  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  return { supabase: supabase as unknown as ServerClient, token };
}

export async function getAuthenticatedUser() {
  const bearer = await bearerClient();
  if (bearer) {
    const {
      data: { user },
      error
    } = await bearer.supabase.auth.getUser(bearer.token);
    // Selrano is private: an account that is not on the allowlist is treated as signed out.
    if (error || !user || !isAllowedEmail(user.email)) return { supabase: bearer.supabase, user: null };
    return { supabase: bearer.supabase, user };
  }

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
