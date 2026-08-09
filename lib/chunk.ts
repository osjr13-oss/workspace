export type TextPage = { pageNumber: number; start: number; end: number };

export type LocatedChunk = {
  content: string;
  charStart: number;
  charEnd: number;
  pageNumber: number | null;
};

/**
 * Page/offset-aware chunker used only by the upload route, so citations can
 * jump back to the exact passage a claim came from. It operates directly on the
 * untouched text (no whitespace collapsing) so charStart/charEnd are valid slice
 * offsets into the same string stored on files.extracted_text. Collapsing
 * whitespace first would desync the two.
 */
export function chunkTextWithLocations(text: string, pages: TextPage[] = [], maxLength = 1800): LocatedChunk[] {
  if (!text.trim()) return [];

  const chunks: LocatedChunk[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
    if (cursor >= text.length) break;

    const end = Math.min(cursor + maxLength, text.length);
    const slice = text.slice(cursor, end);
    const boundary = end < text.length ? Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("\n"), slice.lastIndexOf(" ")) : slice.length;
    const size = boundary > maxLength * 0.55 ? boundary + 1 : slice.length;

    const rawChunk = text.slice(cursor, cursor + size);
    const trimmedChunk = rawChunk.trim();

    if (trimmedChunk) {
      const leadingWhitespace = rawChunk.length - rawChunk.trimStart().length;
      const charStart = cursor + leadingWhitespace;
      const charEnd = charStart + trimmedChunk.length;
      chunks.push({
        content: trimmedChunk,
        charStart,
        charEnd,
        pageNumber: pages.length ? findPageNumber(pages, charStart) : null
      });
    }

    cursor += Math.max(size, 1);
  }

  return chunks;
}

function findPageNumber(pages: TextPage[], offset: number): number | null {
  for (const page of pages) {
    if (offset >= page.start && offset < page.end) return page.pageNumber;
  }
  let nearest: number | null = null;
  for (const page of pages) {
    if (page.start <= offset) nearest = page.pageNumber;
  }
  return nearest;
}
