import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAllowedEmail, isOpenPath } from "@/lib/access";
import { contentSecurityPolicy, newNonce } from "@/lib/csp";

// Selrano is private (lib/access.ts): every page except the open ones needs an
// allowed account. Pages that redirect a signed-in visitor to the workspace.
const authOnlyPaths = ["/signin"];

export async function middleware(request: NextRequest) {
  // Pages get a one-time script pass (lib/csp.ts). Next reads it from the request
  // headers to stamp its own scripts, and the browser enforces it from the response.
  const nonce = newNonce();
  const csp = contentSecurityPolicy(nonce);
  const passOn = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", csp);
    return NextResponse.next({ request: { headers } });
  };
  const withCsp = (result: NextResponse) => {
    result.headers.set("Content-Security-Policy", csp);
    return result;
  };
  let response = passOn();
  const pathname = request.nextUrl.pathname;
  const hasSupabaseConfig = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  // Retired public pages.
  if (pathname === "/signup") {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!hasSupabaseConfig) {
    // Fail closed: without auth configured, only the open pages load.
    if (pathname.startsWith("/api/")) return NextResponse.next({ request });
    if (isOpenPath(pathname)) return withCsp(response);
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // API routes check the session themselves. Skipping it here saves a full
  // round trip to Supabase on every request, including each chat message.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next({ request });
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
          response = passOn();
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  let {
    data: { user }
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

  if (user && !isAllowedEmail(user.email)) {
    await supabase.auth.signOut({ scope: "local" });
    user = null;
    if (pathname !== "/signin") return redirectTo("/signin", { private: "1" });
  }

  if (!user && !isOpenPath(pathname)) {
    return redirectTo("/signin", { next: pathname });
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
    return redirectTo("/dashboard");
  }

  return withCsp(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon(?:-maskable)?|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
