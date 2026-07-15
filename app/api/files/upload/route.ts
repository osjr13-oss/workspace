import { NextResponse } from "next/server";
import { embedChunksForFile } from "@/lib/embeddings";
import { chunkTextWithLocations } from "@/lib/chunk";
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

      const located = chunkTextWithLocations(extraction.text, extraction.pages);
      let embedded = 0;
      if (located.length) {
        const { data: insertedChunks, error: chunkError } = await supabase
          .from("file_chunks")
          .insert(
            located.map((chunk, index) => ({
              user_id: user.id,
              file_id: fileRecord.id,
              project_id: projectId,
              chunk_index: index,
              content: chunk.content,
              page_number: chunk.pageNumber,
              char_start: chunk.charStart,
              char_end: chunk.charEnd
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

      return NextResponse.json({ file: fileRecord, chunks: located.length, embedded });
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

type ExtractedPage = { pageNumber: number; text: string; start: number; end: number };
type ExtractionResult = { supported: boolean; text: string; pages: ExtractedPage[] };

async function extractText(name: string, mimeType: string, bytes: Buffer): Promise<ExtractionResult> {
  const extension = name.toLowerCase().split(".").pop() || "";

  if (["txt", "md", "markdown"].includes(extension) || mimeType.startsWith("text/")) {
    return { supported: true, text: bytes.toString("utf8"), pages: [] };
  }

  if (extension === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: bytes });
    return { supported: true, text: result.value.trim(), pages: [] };
  }

  if (extension === "pdf" || mimeType === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const rawPages: string[] = [];

    // Custom pagerender captures each page's text separately (mirrors pdf-parse's
    // own default renderer) so we can compute per-page character ranges below —
    // the stock API only ever returns one flattened string with no boundaries.
    const result = await pdfParse(bytes, {
      pagerender: async (pageData) => {
        const textContent = await pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
        let lastY;
        let text = "";
        for (const item of textContent.items) {
          if (lastY === item.transform[5] || lastY === undefined) {
            text += item.str;
          } else {
            text += "\n" + item.str;
          }
          lastY = item.transform[5];
        }
        rawPages.push(text);
        return text;
      }
    });

    // pdf-parse builds ret.text as `${acc}\n\n${pageText}` starting from "" for
    // every page (including the first), so the raw text always starts with a
    // leading "\n\n". Mirror that exact join to compute each page's character
    // range, then shift by whatever .trim() below removes from the front so the
    // ranges stay valid against the trimmed text we actually store and chunk.
    const raw = result.text;
    const trimmed = raw.trim();
    const leadingTrim = raw.length - raw.trimStart().length;

    let cursor = 0;
    const pages: ExtractedPage[] = rawPages.map((pageText, index) => {
      cursor += 2; // "\n\n" separator
      const rawStart = cursor;
      cursor += pageText.length;
      const rawEnd = cursor;
      return {
        pageNumber: index + 1,
        text: pageText,
        start: Math.max(0, Math.min(trimmed.length, rawStart - leadingTrim)),
        end: Math.max(0, Math.min(trimmed.length, rawEnd - leadingTrim))
      };
    });

    return { supported: true, text: trimmed, pages };
  }

  return { supported: false, text: "", pages: [] };
}
