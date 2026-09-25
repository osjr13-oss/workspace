import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseConfigured } from "@/lib/supabase/config";

const protectedPrefixes = ["/chats", "/notes", "/flashcards"];
const authOnlyPaths = ["/signin", "/signup"];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  if (!supabaseConfigured()) return response;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
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
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(pathname)) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/signin";
    signIn.searchParams.set("next", pathname);
    return NextResponse.redirect(signIn);
  }

  if (user && (authOnlyPaths.includes(pathname) || pathname === "/")) {
    const next = request.nextUrl.searchParams.get("next");
    if (next?.startsWith("/") && !next.startsWith("//")) {
      const target = new URL(next, request.nextUrl.origin);
      const dest = request.nextUrl.clone();
      dest.pathname = target.pathname;
      dest.search = target.search;
      return NextResponse.redirect(dest);
    }
    const chats = request.nextUrl.clone();
    chats.pathname = "/chats";
    chats.search = "";
    return NextResponse.redirect(chats);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
