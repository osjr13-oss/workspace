import { NextResponse } from "next/server";
import { embedChunksForFile } from "@/lib/embeddings";
import { chunkText } from "@/lib/chunk";
import { serializeError } from "@/lib/serialize-error";
import { assertFileSizeLimit, getUserLimits } from "@/lib/tier";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as {
      storagePath?: string;
      name?: string;
      type?: string;
      size?: number;
      projectId?: string | null;
    };
    const storagePath = body.storagePath?.trim();
    const name = body.name?.trim();
    const mimeType = body.type?.trim() || "application/octet-stream";
    const declaredSize = Number(body.size);
    const projectId = body.projectId || null;
    if (!storagePath || !name || !Number.isFinite(declaredSize) || declaredSize <= 0) {
      return NextResponse.json({ error: "Valid uploaded file metadata is required" }, { status: 400 });
    }
    if (!storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Invalid storage path" }, { status: 403 });
    }

    const limits = await getUserLimits(supabase, user.id);
    const sizeError = assertFileSizeLimit(declaredSize, limits);
    if (sizeError) return NextResponse.json({ error: sizeError, code: "plan_limit" }, { status: 403 });

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

    let fileRecordId: string | null = null;
    try {
      const { data: existing } = await supabase.from("files").select("id").eq("storage_path", storagePath).maybeSingle();
      if (existing) return NextResponse.json({ error: "This upload has already been processed." }, { status: 409 });

      const { data: storedFile, error: downloadError } = await supabase.storage.from("workspace-files").download(storagePath);
      if (downloadError) throw downloadError;
      if (storedFile.size !== declaredSize) throw new Error("Uploaded file size did not match the signed request.");

      const bytes = Buffer.from(await storedFile.arrayBuffer());
      const extraction = await extractText(name, mimeType, bytes);
      if (!extraction.supported) throw new Error("Unsupported file type. Upload a PDF, DOCX, TXT, or Markdown file.");
      if (!extraction.text.trim()) throw new Error("No readable text was found. Scanned or image-only documents are not supported yet.");

      const { data: fileRecord, error: insertError } = await supabase
        .from("files")
        .insert({
          user_id: user.id,
          project_id: projectId,
          name,
          storage_path: storagePath,
          mime_type: mimeType,
          size_bytes: storedFile.size,
          extraction_status: "ready",
          extracted_text: extraction.text
        })
        .select("*")
        .single();

      if (insertError) throw insertError;
      fileRecordId = fileRecord.id;

      const chunks = chunkText(extraction.text);
      let embedded = 0;
      if (chunks.length) {
        const { data: insertedChunks, error: chunkError } = await supabase
          .from("file_chunks")
          .insert(
            chunks.map((content, index) => ({
              user_id: user.id,
              file_id: fileRecord.id,
              project_id: projectId,
              chunk_index: index,
              content
            }))
          )
          .select("id, content");
        if (chunkError) throw chunkError;
        embedded = await embedChunksForFile(supabase, {
          userId: user.id,
          fileId: fileRecord.id,
          projectId,
          chunks: insertedChunks || []
        });
      }

      return NextResponse.json({ file: fileRecord, chunks: chunks.length, embedded });
    } catch (error) {
      if (fileRecordId) await supabase.from("files").delete().eq("id", fileRecordId);
      await supabase.storage.from("workspace-files").remove([storagePath]);
      throw error;
    }
  } catch (error) {
    const message = serializeError(error);
    console.error("[upload]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function extractText(name: string, mimeType: string, bytes: Buffer) {
  const extension = name.toLowerCase().split(".").pop() || "";

  if (["txt", "md", "markdown"].includes(extension) || mimeType.startsWith("text/")) {
    return { supported: true, text: bytes.toString("utf8") };
  }

  if (extension === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: bytes });
    return { supported: true, text: result.value.trim() };
  }

  if (extension === "pdf" || mimeType === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(bytes);
    return { supported: true, text: result.text.trim() };
  }

  return { supported: false, text: "" };
}
