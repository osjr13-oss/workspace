import { Text } from "react-native";
import { SymbolView, type SFSymbol } from "expo-symbols";

/** SF Symbols on iPhone. The browser preview has no SF Symbols, so it shows a plain stand-in. */
export function Icon({ name, size = 20, color, weight = "regular" }: { name: SFSymbol; size?: number; color: string; weight?: "regular" | "medium" | "semibold" | "bold" }) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      weight={weight}
      style={{ width: size, height: size }}
      fallback={<Text style={{ color, fontSize: size * 0.8, lineHeight: size, width: size, textAlign: "center" }}>{FALLBACKS[name] ?? "•"}</Text>}
    />
  );
}

const FALLBACKS: Partial<Record<SFSymbol, string>> = {
  "square.and.pencil": "✎",
  "arrow.up": "↑",
  "stop.fill": "■",
  "plus": "+",
  "paperclip": "+",
  "doc.on.doc": "⧉",
  "arrow.clockwise": "↻",
  "chevron.down": "⌄",
  "arrow.down": "↓",
  "folder": "▢",
  "doc.text": "▤",
  "xmark": "×",
  "person.crop.circle": "◯",
  "magnifyingglass": "⌕",
  "ellipsis": "…",
  "checkmark": "✓"
};
