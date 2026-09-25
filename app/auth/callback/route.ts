import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sendWelcomeEmailOnce } from "@/lib/email/templates";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/chats";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/chats";

  if (!code) return NextResponse.redirect(`${origin}/signin?error=auth`);

  let response = NextResponse.redirect(`${origin}${safeNext}`);
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.redirect(`${origin}${safeNext}`);
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/signin?error=auth`);

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (user) await sendWelcomeEmailOnce(user);
  } catch (welcomeError) {
    console.error("[auth/callback] welcome email failed", welcomeError);
  }

  return response;
}
