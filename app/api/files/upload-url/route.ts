import { NextResponse } from "next/server";
import { serializeError } from "@/lib/serialize-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { assertFileSizeLimit, getUserLimits } from "@/lib/tier";

export const runtime = "nodejs";

const SUPPORTED_EXTENSIONS = new Set(["pdf", "docx", "txt", "md", "markdown"]);

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as {
      name?: string;
      type?: string;
      size?: number;
      projectId?: string | null;
    };
    const name = body.name?.trim();
    const size = Number(body.size);
    const projectId = body.projectId || null;
    if (!name || !Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: "Valid file metadata is required" }, { status: 400 });
    }

    const extension = name.toLowerCase().split(".").pop() || "";
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ error: "Unsupported file type. Upload a PDF, DOCX, TXT, or Markdown file." }, { status: 415 });
    }

    const limits = await getUserLimits(supabase, user.id);
    const sizeError = assertFileSizeLimit(size, limits);
    if (sizeError) return NextResponse.json({ error: sizeError, code: "plan_limit", reason: "file_size" }, { status: 403 });

    if (projectId) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (projectError) throw projectError;
      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });
    }

    const safeName = name.replace(/[^\w.\-]+/g, "_");
    const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.storage.from("workspace-files").createSignedUploadUrl(storagePath);
    if (error) throw error;

    return NextResponse.json({ storagePath, token: data.token });
  } catch (error) {
    const message = serializeError(error);
    console.error("[upload-url]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
