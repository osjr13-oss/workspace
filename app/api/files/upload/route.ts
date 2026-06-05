import { NextResponse } from "next/server";
import { embedChunksForFile } from "@/lib/embeddings";
import { chunkText } from "@/lib/chunk";
import { serializeError } from "@/lib/serialize-error";
import { assertFileSizeLimit, getUserLimits } from "@/lib/tier";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    const projectId = (form.get("projectId") as string | null) || null;
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const limits = await getUserLimits(supabase, user.id);
    const sizeError = assertFileSizeLimit(file.size, limits);
    if (sizeError) return NextResponse.json({ error: sizeError, code: "plan_limit" }, { status: 403 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const storagePath = `${user.id}/${Date.now()}-${safeName}`;

    const upload = await supabase.storage.from("workspace-files").upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false
    });
    if (upload.error) throw upload.error;

    const extraction = await extractText(file.name, file.type, bytes);
    const status = extraction.supported ? (extraction.text ? "ready" : "unsupported") : "unsupported";

    const { data: fileRecord, error: insertError } = await supabase
      .from("files")
      .insert({
        user_id: user.id,
        project_id: projectId,
        name: file.name,
        storage_path: storagePath,
        mime_type: file.type || null,
        size_bytes: file.size,
        extraction_status: status,
        extracted_text: extraction.text || null
      })
      .select("*")
      .single();

    if (insertError) throw insertError;

    const chunks = chunkText(extraction.text || "");
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
    const message = serializeError(error);
    console.error("[upload]", message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function extractText(name: string, mimeType: string, bytes: Buffer) {
  const extension = name.toLowerCase().split(".").pop() || "";

  if (mimeType.startsWith("image/")) {
    return { supported: false, text: "" };
  }

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
