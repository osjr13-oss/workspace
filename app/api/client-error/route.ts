import { NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Receives browser-side crashes so they show up in server logs as `[client-error]`. */
export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await allowRequest("client.error", ip, 20, 600))) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }
    const body = (await request.json()) as { message?: string; digest?: string; path?: string };
    console.error(
      "[client-error]",
      JSON.stringify({
        message: String(body.message || "").slice(0, 500),
        digest: String(body.digest || "").slice(0, 100),
        path: String(body.path || "").split("?")[0].slice(0, 200)
      })
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
