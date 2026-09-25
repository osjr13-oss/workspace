import { NextResponse } from "next/server";
import { chunkText, extractText } from "@/lib/files";
import { serializeError } from "@/lib/serialize-error";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Sign in to attach a file." }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to attach." }, { status: 400 });
    if (!file.size) return NextResponse.json({ error: "That file is empty." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Files must be 8 MB or smaller." }, { status: 400 });

    const extracted = await extractText(file);
    const storagePath = `chat/${user.id}/${crypto.randomUUID()}`;
    const { data, error } = await supabase
      .from("files")
      .insert({
        user_id: user.id,
        name: file.name.slice(0, 240),
        storage_path: storagePath,
        mime_type: file.type || null,
        size_bytes: file.size,
        extraction_status: extracted.status,
        extracted_text: extracted.text
      })
      .select("id, name, extraction_status")
      .single();
    if (error || !data) throw error || new Error("Could not save the file.");

    if (extracted.text) {
      const chunks = chunkText(extracted.text);
      if (chunks.length) {
        const { error: chunkError } = await supabase.from("file_chunks").insert(
          chunks.map((chunk, index) => ({
            user_id: user.id,
            file_id: data.id,
            chunk_index: index,
            content: chunk.content,
            char_start: chunk.charStart,
            char_end: chunk.charEnd
          }))
        );
        if (chunkError) console.error("[files] chunk insert failed", chunkError.message);
      }
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      extractionStatus: data.extraction_status,
      notice: extracted.notice
    });
  } catch (error) {
    return NextResponse.json({ error: serializeError(error) }, { status: 500 });
  }
}
