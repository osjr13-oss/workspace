/**
 * Makes a half-streamed Markdown reply render cleanly.
 *
 * While a reply is still arriving, the tail is often unfinished: an opening
 * `**` with no closing one, a table row cut off mid-cell, a bare `1.` waiting
 * for its text. Rendered as-is those show up as stray symbols that vanish a
 * moment later. This closes or hides only the unfinished tail, so the text that
 * is already there never changes shape. Finished text is returned untouched.
 */
export function healStreamingMarkdown(input: string): string {
  let text = input;

  // An unclosed code fence: close it and stop, nothing inside it is formatting.
  const fences = text.match(/^\s*(```|~~~)/gm);
  if (fences && fences.length % 2 === 1) return `${text}\n\`\`\``;

  let lines = text.split("\n");

  // Hide a table until its header and divider row have both arrived, and hide a
  // row that is cut off mid-way.
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim().startsWith("|")) end -= 1;
  const block = lines.slice(end);
  if (block.length) {
    if (!block[block.length - 1].trim().endsWith("|")) block.pop();
    // A header row alone is not a table yet, and neither is a divider row that is still
    // being written (fewer columns than the header): both stay hidden until complete.
    const cells = (row: string) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").length;
    const dividerDone = block.length >= 2 && /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-*:?\s*$/.test(block[1]) && cells(block[1]) >= cells(block[0]);
    lines = dividerDone ? [...lines.slice(0, end), ...block] : lines.slice(0, end);
  }

  // A heading or list marker with nothing after it yet would render as an empty line or bullet.
  const last = lines[lines.length - 1] ?? "";
  if (/^\s*(#{1,6}|[-*+]|\d+[.)])\s*$/.test(last)) lines = lines.slice(0, -1);

  text = lines.join("\n");

  // A half-written link or citation: show the words, not the brackets.
  text = text.replace(/\[([^\]\n]*)\]\([^)\n]*$/, "$1");
  text = text.replace(/\[\d*$/, "");

  // Close unfinished emphasis within the paragraph still being written.
  const breakAt = text.lastIndexOf("\n\n");
  const paragraph = (breakAt === -1 ? text : text.slice(breakAt + 2)).replace(/(```|~~~)[\s\S]*?\1/g, "");
  const withoutMarkers = paragraph.replace(/^\s*[-*+]\s/gm, "");
  const close = (marker: string, opened: boolean) => {
    if (!opened) return;
    // A marker right at the end has nothing inside yet: drop it. Otherwise close
    // it against the last word, since markdown ignores a closer that follows a space.
    const dangling = new RegExp(`${marker.replace(/[*`~]/g, "\\$&")}\\s*$`);
    text = dangling.test(text) ? text.replace(dangling, "") : `${text.replace(/\s+$/, "")}${marker}`;
  };
  close("`", (withoutMarkers.match(/`/g) || []).length % 2 === 1);
  close("**", (withoutMarkers.match(/\*\*/g) || []).length % 2 === 1);
  close("~~", (withoutMarkers.match(/~~/g) || []).length % 2 === 1);
  const singles = withoutMarkers.replace(/\*\*/g, "");
  close("*", (singles.match(/(^|[\s(])\*(?=\S)/g) || []).length > (singles.match(/\S\*($|[\s).,;:!?])/g) || []).length);

  return text;
}
