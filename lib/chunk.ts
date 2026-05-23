export function chunkText(text: string, maxLength = 1800) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const end = Math.min(cursor + maxLength, normalized.length);
    const slice = normalized.slice(cursor, end);
    const boundary = end < normalized.length ? Math.max(slice.lastIndexOf(". "), slice.lastIndexOf(" ")) : slice.length;
    const size = boundary > maxLength * 0.55 ? boundary + 1 : slice.length;
    chunks.push(normalized.slice(cursor, cursor + size).trim());
    cursor += size;
  }

  return chunks.filter(Boolean);
}
