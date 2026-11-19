import { NextResponse } from "next/server";
import { googleAuthUrl, isGoogleConfigured } from "@/lib/google";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const GOOGLE_STATE_COOKIE = "selrano_google_state";

/** Begins connecting Google: a random state is kept in a short-lived cookie and checked on the way back. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const { user } = await getAuthenticatedUser();
  if (!user) return NextResponse.redirect(`${origin}/signin?next=/settings`);
  if (!isGoogleConfigured()) return NextResponse.redirect(`${origin}/settings?google=not_configured`);

  const state = crypto.randomUUID();
  const response = NextResponse.redirect(googleAuthUrl(origin, state, user.email));
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/integrations/google",
    maxAge: 600
  });
  return response;
}
