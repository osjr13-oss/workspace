import { useColorScheme } from "react-native";

const light = {
  background: "#FFFFFF",
  surface: "#F4F4F5",
  elevated: "#FFFFFF",
  border: "rgba(0,0,0,0.08)",
  text: "#111113",
  muted: "#6E6E73",
  faint: "#AEAEB2",
  accent: "#111113",
  onAccent: "#FFFFFF",
  userBubble: "#F0F0F2",
  critical: "#D7372F",
  code: "#17181C",
  codeText: "#ECEAE4"
};

const dark: typeof light = {
  background: "#0B0B0C",
  surface: "#1C1C1E",
  elevated: "#161618",
  border: "rgba(255,255,255,0.1)",
  text: "#F4F4F5",
  muted: "#98989F",
  faint: "#5A5A60",
  accent: "#F4F4F5",
  onAccent: "#0B0B0C",
  userBubble: "#232326",
  critical: "#FF6961",
  code: "#1C1C1E",
  codeText: "#ECEAE4"
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
