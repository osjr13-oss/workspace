import { NextResponse, type NextRequest } from "next/server";
import { completeGoogleConnection } from "@/lib/google";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const STATE_COOKIE = "selrano_google_state";

/** Google sends the owner back here after they approve access. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const done = (result: string) => {
    const response = NextResponse.redirect(`${origin}/settings?google=${result}`);
    response.cookies.set(STATE_COOKIE, "", { path: "/api/integrations/google", maxAge: 0 });
    return response;
  };

  const { user } = await getAuthenticatedUser();
  if (!user) return NextResponse.redirect(`${origin}/signin?next=/settings`);

  const state = url.searchParams.get("state");
  const expected = request.cookies.get(STATE_COOKIE)?.value;
  if (!state || !expected || state !== expected) return done("failed");
  if (url.searchParams.get("error")) return done("cancelled");

  const code = url.searchParams.get("code");
  if (!code) return done("failed");

  try {
    await completeGoogleConnection(user.id, origin, code);
    return done("connected");
  } catch (error) {
    console.error("[google] connect failed", serializeError(error));
    return done("failed");
  }
}
