import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAllowedEmail, isOpenPath } from "@/lib/access";

const protectedPrefixes = ["/today", "/progress", "/chats", "/settings", "/onboarding"];

const authOnlyPaths = ["/signin", "/signup"];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const hasSupabaseConfig = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!hasSupabaseConfig) {
    return response;
  }

  // API routes check the session themselves. Skipping it here saves a full
  // round trip to Supabase on every request, including each chat message.
  if (pathname.startsWith("/api/")) {
    return response;
  }

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const {
    data: { user: sessionUser }
  } = await supabase.auth.getUser();

  // Carries any refreshed or cleared session cookies onto a redirect.
  const redirectTo = (pathname: string, params: Record<string, string> = {}) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // Selrano is private (lib/access.ts). A session for an account that is not on
  // the allowlist is ended here, so it can never reach the app.
  let user = sessionUser;
  if (user && !isAllowedEmail(user.email)) {
    await supabase.auth.signOut({ scope: "local" });
    user = null;
    if (pathname !== "/signin") return redirectTo("/signin", { private: "1" });
  }

  if (!user && !isOpenPath(pathname)) {
    return redirectTo("/signin", isProtectedPath(pathname) ? { next: pathname } : {});
  }

  if (user && (pathname === "/" || authOnlyPaths.includes(pathname))) {
    const next = request.nextUrl.searchParams.get("next");
    if (next?.startsWith("/") && !next.startsWith("//")) {
      const target = new URL(next, request.nextUrl.origin);
      const dest = request.nextUrl.clone();
      dest.pathname = target.pathname;
      dest.search = target.search;
      return NextResponse.redirect(dest);
    }
    return redirectTo("/today");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|fake-supabase|manifest.webmanifest|icon(?:-maskable)?|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
