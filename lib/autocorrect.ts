type Correction = {
  original: string;
  correction: string;
};

const COMMON_CORRECTIONS: Record<string, string> = {
  adn: "and",
  becuase: "because",
  beleive: "believe",
  cant: "can't",
  definately: "definitely",
  didnt: "didn't",
  doesnt: "doesn't",
  dont: "don't",
  couldnt: "couldn't",
  isnt: "isn't",
  recieve: "receive",
  seperate: "separate",
  shouldnt: "shouldn't",
  taht: "that",
  teh: "the",
  thier: "their",
  tommorow: "tomorrow",
  wasnt: "wasn't",
  wierd: "weird",
  wont: "won't",
  wouldnt: "wouldn't",
  youre: "you're"
};

function preserveCase(original: string, correction: string) {
  if (original === original.toUpperCase()) return correction.toUpperCase();
  if (original[0] === original[0]?.toUpperCase()) {
    return correction[0].toUpperCase() + correction.slice(1);
  }
  return correction;
}

export function autocorrectOnBoundary(
  value: string,
  cursor: number
): { text: string; correction: Correction | null; cursor: number } {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/([A-Za-z']+)([\s.,!?;:])$/);
  if (!match) return { text: value, correction: null, cursor };

  const original = match[1];
  const replacement = COMMON_CORRECTIONS[original.toLowerCase()];
  if (!replacement) return { text: value, correction: null, cursor };

  const correction = preserveCase(original, replacement);
  const wordStart = cursor - match[2].length - original.length;
  const text = `${value.slice(0, wordStart)}${correction}${value.slice(wordStart + original.length)}`;
  return {
    text,
    correction: { original, correction },
    cursor: cursor + correction.length - original.length
  };
}
