import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${process.env.NODE_ENV === "development" ? " ws:" : ""}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
  ].join("; ");
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", policy);
  const secure = (result: NextResponse) => {
    result.headers.set("Content-Security-Policy", policy);
    return result;
  };
  const response = secure(NextResponse.next({ request }));
  if (!["/", "/api/prototype/chat"].includes(request.nextUrl.pathname))
    return new NextResponse("Not available in this prototype", { status: 404 });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|sw.js|manifest.webmanifest|icon(?:-maskable)?|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
