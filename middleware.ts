import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const protectedPrefixes = [
  "/dashboard",
  "/scans",
  "/copilot",
  "/chats",
  "/projects",
  "/notes",
  "/files",
  "/flashcards",
  "/study",
  "/settings",
  "/help"
];

const authOnlyPaths = ["/signin", "/signup"];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: " + supabaseOrigin,
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace("https:", "wss:")} https://*.supabase.co https://vitals.vercel-insights.com${process.env.NODE_ENV === "development" ? " ws: " : ""}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob: " + supabaseOrigin,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : [])
  ].join("; ");
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", policy);
  const secure = (result: NextResponse) => {
    result.headers.set("Content-Security-Policy", policy);
    return result;
  };
  let response = secure(NextResponse.next({ request }));
  const pathname = request.nextUrl.pathname;
  const hasSupabaseConfig = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!hasSupabaseConfig) {
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
          response = secure(NextResponse.next({ request }));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(pathname)) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/signin";
    signIn.searchParams.set("next", pathname);
    return secure(NextResponse.redirect(signIn));
  }

  if (user && authOnlyPaths.includes(pathname)) {
    const next = request.nextUrl.searchParams.get("next");
    if (next?.startsWith("/") && !next.startsWith("//")) {
      const target = new URL(next, request.nextUrl.origin);
      const dest = request.nextUrl.clone();
      dest.pathname = target.pathname;
      dest.search = target.search;
      return secure(NextResponse.redirect(dest));
    }
    const dashboard = request.nextUrl.clone();
    dashboard.pathname = "/dashboard";
    dashboard.search = "";
    return secure(NextResponse.redirect(dashboard));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon(?:-maskable)?|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
