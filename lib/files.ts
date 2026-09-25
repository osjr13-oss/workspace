export type Extraction = {
  status: "ready" | "unsupported" | "failed";
  text: string | null;
  notice: string | null;
};

export function chunkText(text: string, size = 1800) {
  const chunks: Array<{ content: string; charStart: number; charEnd: number }> = [];
  const capped = text.slice(0, 80_000);
  for (let index = 0; index < capped.length && chunks.length < 40; index += size) {
    const content = capped.slice(index, index + size);
    chunks.push({ content, charStart: index, charEnd: index + content.length });
  }
  return chunks;
}

export async function extractText(file: File): Promise<Extraction> {
  const name = file.name.toLowerCase();
  const type = file.type || "";
  const buffer = Buffer.from(await file.arrayBuffer());

  if (
    type.startsWith("text/") ||
    name.endsWith(".md") ||
    name.endsWith(".txt") ||
    name.endsWith(".csv") ||
    name.endsWith(".json")
  ) {
    const text = buffer.toString("utf8");
    if (text.includes("\u0000")) {
      return { status: "failed", text: null, notice: "That file could not be read as text." };
    }
    return { status: "ready", text, notice: null };
  }

  if (name.endsWith(".pdf") || type === "application/pdf") {
    try {
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as (data: Buffer) => Promise<{ text?: string }>;
      const result = await pdfParse(buffer);
      const text = (result.text || "").trim();
      if (!text) return { status: "failed", text: null, notice: "No text could be read from that PDF." };
      return { status: "ready", text, notice: null };
    } catch {
      return { status: "failed", text: null, notice: "That PDF could not be read." };
    }
  }

  if (name.endsWith(".docx") || type.includes("wordprocessingml")) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value || "").trim();
      if (!text) return { status: "failed", text: null, notice: "No text could be read from that document." };
      return { status: "ready", text, notice: null };
    } catch {
      return { status: "failed", text: null, notice: "That document could not be read." };
    }
  }

  return { status: "unsupported", text: null, notice: "That file type cannot be read as text." };
}
