import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/audit";
import { sendWelcomeEmailOnce } from "@/lib/email/welcome";
import { captureReferral } from "@/lib/referrals";

const REFERRAL_COOKIE = "selrano_ref";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  // Prefer the cookie set on /signup. Supabase's confirmation redirect
  // doesn't reliably preserve the "ref" query param through emailRedirectTo,
  // so the query param is a best-effort fallback, not the primary source.
  const ref = request.cookies.get(REFERRAL_COOKIE)?.value || searchParams.get("ref");

  if (!code) {
    return NextResponse.redirect(`${origin}/signin?error=auth`);
  }

  let response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.redirect(`${origin}${next}`);
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/signin?error=auth`);
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await sendWelcomeEmailOnce(user, { ip: clientIp(request) });
    if (user && ref) await captureReferral(ref, user.id);
  } catch (welcomeError) {
    console.error("[auth/callback] welcome email failed", welcomeError);
  }

  // Clear the referral cookie so it can't be reattributed to a later,
  // unrelated signup from the same browser (e.g. a shared computer).
  if (request.cookies.get(REFERRAL_COOKIE)) {
    response.cookies.set(REFERRAL_COOKIE, "", { path: "/", maxAge: 0 });
  }

  return response;
}
