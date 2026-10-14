import { Fragment, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View, type TextStyle } from "react-native";
import * as Clipboard from "expo-clipboard";
import { marked, type Token, type Tokens } from "marked";
import { healStreamingMarkdown } from "@shared/stream-markdown";
import type { Citation } from "@shared/types";
import { Icon } from "@/components/Icon";
import { useTheme, type Theme } from "@/lib/theme";

const BODY = 17;
const LINE = 26;

/** Renders an answer's Markdown as native text. Unfinished formatting at the tail of a streaming reply is tidied first. */
export function Markdown({ content, streaming, citations = [] }: { content: string; streaming: boolean; citations?: Citation[] }) {
  const theme = useTheme();
  const tokens = useMemo(() => {
    const source = streaming ? healStreamingMarkdown(content) : content;
    // Bracketed citation markers become links the renderer turns into small badges.
    const linked = citations.length ? source.replace(/\[(\d+)\]/g, (marker, id) => `[${marker}](citation:${id})`) : source;
    return marked.lexer(linked, { gfm: true });
  }, [content, streaming, citations.length]);

  return <View style={{ gap: 12 }}>{tokens.map((token, i) => <Block key={i} token={token} theme={theme} citations={citations} />)}</View>;
}

function Block({ token, theme, citations }: { token: Token; theme: Theme; citations: Citation[] }) {
  const base: TextStyle = { color: theme.text, fontSize: BODY, lineHeight: LINE };
  switch (token.type) {
    case "heading": {
      const heading = token as Tokens.Heading;
      const size = heading.depth <= 1 ? 22 : heading.depth === 2 ? 20 : 18;
      return (
        <Text accessibilityRole="header" style={{ ...base, fontSize: size, lineHeight: size * 1.3, fontWeight: "700", marginTop: 6 }}>
          <Inline tokens={heading.tokens} theme={theme} citations={citations} />
        </Text>
      );
    }
    case "paragraph":
      return (
        <Text style={base} selectable>
          <Inline tokens={(token as Tokens.Paragraph).tokens} theme={theme} citations={citations} />
        </Text>
      );
    case "list": {
      const list = token as Tokens.List;
      const start = typeof list.start === "number" ? list.start : 1;
      return (
        <View style={{ gap: 6 }}>
          {list.items.map((item, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8, paddingRight: 4 }}>
              <Text style={{ ...base, color: theme.muted, minWidth: list.ordered ? 22 : 12, textAlign: "right" }}>{list.ordered ? `${start + i}.` : "•"}</Text>
              <View style={{ flex: 1, gap: 6 }}>
                {item.tokens.map((child, j) =>
                  child.type === "text" ? (
                    <Text key={j} style={base} selectable>
                      <Inline tokens={(child as Tokens.Text).tokens ?? [child]} theme={theme} citations={citations} />
                    </Text>
                  ) : (
                    <Block key={j} token={child} theme={theme} citations={citations} />
                  )
                )}
              </View>
            </View>
          ))}
        </View>
      );
    }
    case "code":
      return <CodeBlock code={(token as Tokens.Code).text} language={(token as Tokens.Code).lang || ""} theme={theme} />;
    case "blockquote":
      return (
        <View style={{ borderLeftWidth: 2, borderLeftColor: theme.faint, paddingLeft: 12, gap: 8 }}>
          {(token as Tokens.Blockquote).tokens.map((child, i) => (
            <Block key={i} token={child} theme={theme} citations={citations} />
          ))}
        </View>
      );
    case "hr":
      return <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 4 }} />;
    case "table":
      return <Table table={token as Tokens.Table} theme={theme} citations={citations} />;
    case "space":
      return null;
    default:
      return "text" in token && token.text ? (
        <Text style={base} selectable>
          {String(token.text)}
        </Text>
      ) : null;
  }
}

function Inline({ tokens, theme, citations }: { tokens: Token[]; theme: Theme; citations: Citation[] }) {
  return (
    <>
      {tokens.map((token, i) => {
        switch (token.type) {
          case "strong":
            return (
              <Text key={i} style={{ fontWeight: "700" }}>
                <Inline tokens={(token as Tokens.Strong).tokens} theme={theme} citations={citations} />
              </Text>
            );
          case "em":
            return (
              <Text key={i} style={{ fontStyle: "italic" }}>
                <Inline tokens={(token as Tokens.Em).tokens} theme={theme} citations={citations} />
              </Text>
            );
          case "del":
            return (
              <Text key={i} style={{ textDecorationLine: "line-through" }}>
                <Inline tokens={(token as Tokens.Del).tokens} theme={theme} citations={citations} />
              </Text>
            );
          case "codespan":
            return (
              <Text key={i} style={{ fontFamily: "Menlo", fontSize: BODY - 2, backgroundColor: theme.surface }}>
                {` ${decode((token as Tokens.Codespan).text)} `}
              </Text>
            );
          case "br":
            return <Text key={i}>{"\n"}</Text>;
          case "link": {
            const link = token as Tokens.Link;
            if (link.href.startsWith("citation:")) {
              const citation = citations.find((item) => item.marker === link.href.slice("citation:".length));
              return <CitationMark key={i} marker={link.href.slice("citation:".length)} citation={citation} theme={theme} />;
            }
            return (
              <Text key={i} style={{ textDecorationLine: "underline" }} onPress={() => void Linking.openURL(link.href)}>
                <Inline tokens={link.tokens} theme={theme} citations={citations} />
              </Text>
            );
          }
          case "text": {
            const text = token as Tokens.Text;
            return text.tokens?.length ? (
              <Fragment key={i}>
                <Inline tokens={text.tokens} theme={theme} citations={citations} />
              </Fragment>
            ) : (
              <Fragment key={i}>{decode(text.text)}</Fragment>
            );
          }
          case "escape":
            return <Fragment key={i}>{(token as Tokens.Escape).text}</Fragment>;
          default:
            return "text" in token ? <Fragment key={i}>{decode(String(token.text ?? ""))}</Fragment> : null;
        }
      })}
    </>
  );
}

function CitationMark({ marker, citation, theme }: { marker: string; citation?: Citation; theme: Theme }) {
  const url = citation?.kind === "web" ? citation.url : null;
  return (
    <Text
      onPress={url ? () => void Linking.openURL(url) : undefined}
      accessibilityRole={url ? "link" : undefined}
      accessibilityLabel={citation?.kind === "web" ? `Source ${marker}: ${citation.title}` : `Source ${marker}`}
      style={{ fontSize: 12, fontWeight: "700", color: theme.muted }}
    >
      {` [${marker}]`}
    </Text>
  );
}

function CodeBlock({ code, language, theme }: { code: string; language: string; theme: Theme }) {
  const [copied, setCopied] = useState(false);
  return (
    <View style={{ backgroundColor: theme.code, borderRadius: 12, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 14, paddingRight: 6, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
        <Text style={{ color: "rgba(236,234,228,0.6)", fontSize: 12, fontWeight: "600" }}>{language || "code"}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copied ? "Code copied" : "Copy code"}
          hitSlop={8}
          onPress={async () => {
            await Clipboard.setStringAsync(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 6 }}
        >
          <Icon name={copied ? "checkmark" : "doc.on.doc"} size={13} color="rgba(236,234,228,0.75)" />
          <Text style={{ color: "rgba(236,234,228,0.75)", fontSize: 12, fontWeight: "600" }}>{copied ? "Copied" : "Copy"}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 14 }}>
        <Text selectable style={{ color: theme.codeText, fontFamily: "Menlo", fontSize: 13, lineHeight: 20 }}>
          {code}
        </Text>
      </ScrollView>
    </View>
  );
}

function Table({ table, theme, citations }: { table: Tokens.Table; theme: Theme; citations: Citation[] }) {
  const cell = (item: Tokens.TableCell, header: boolean, key: number) => (
    <View key={key} style={{ minWidth: 110, maxWidth: 220, paddingHorizontal: 12, paddingVertical: 8 }}>
      <Text style={{ color: theme.text, fontSize: 15, lineHeight: 21, fontWeight: header ? "700" : "400" }}>
        <Inline tokens={item.tokens} theme={theme} citations={citations} />
      </Text>
    </View>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12 }}>
      <View>
        <View style={{ flexDirection: "row", backgroundColor: theme.surface }}>{table.header.map((item, i) => cell(item, true, i))}</View>
        {table.rows.map((row, r) => (
          <View key={r} style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: theme.border }}>
            {row.map((item, i) => cell(item, false, i))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/** marked escapes a few characters in text tokens; show them as typed. */
function decode(text: string) {
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
