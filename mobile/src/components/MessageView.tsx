import { memo, useState } from "react";
import { ActionSheetIOS, Alert, Linking, Platform, Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { removeEmDashes } from "@shared/text";
import type { ChatMessage, FileCitation, WebCitation } from "@shared/types";
import { Icon } from "@/components/Icon";
import { Markdown } from "@/components/Markdown";
import { useTheme } from "@/lib/theme";

export type DisplayMessage = ChatMessage & { clientKey?: string };

type Props = {
  message: DisplayMessage;
  busy: boolean;
  onEdit: (message: DisplayMessage) => void;
  onRegenerate: (messageId: string) => void;
};

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const MessageView = memo(function MessageView({ message, busy, onEdit, onRegenerate }: Props) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const content = removeEmDashes(message.content);
  const citations = message.citations || [];
  const streaming = message.id.startsWith("streaming");
  const saved = !streaming && !message.id.startsWith("pending") && message.id !== "error";

  async function copy() {
    await Clipboard.setStringAsync(content);
    void Haptics.selectionAsync();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (message.role === "user") {
    const attachments = citations.filter((citation): citation is FileCitation => citation.marker.startsWith("attachment-"));
    const openMenu = () => {
      if (!saved) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const options = busy ? ["Copy", "Cancel"] : ["Copy", "Edit and resend", "Cancel"];
      const handle = (index: number) => {
        if (options[index] === "Copy") void copy();
        if (options[index] === "Edit and resend") onEdit(message);
      };
      if (Platform.OS === "ios") ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1 }, handle);
      else Alert.alert("Message", undefined, options.slice(0, -1).map((label, index) => ({ text: label, onPress: () => handle(index) })));
    };
    return (
      <View accessibilityLabel="Your message" style={{ alignItems: "flex-end", gap: 6 }}>
        {attachments.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 6, maxWidth: "85%" }}>
            {attachments.map((file) => (
              <View key={file.marker} style={{ flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 }}>
                <Icon name="doc.text" size={13} color={theme.muted} />
                <Text numberOfLines={1} style={{ color: theme.text, fontSize: 13, fontWeight: "500", maxWidth: 180 }}>
                  {file.fileName}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <Pressable onLongPress={openMenu} delayLongPress={300} style={{ maxWidth: "85%", backgroundColor: theme.userBubble, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10 }}>
          <Text selectable={false} style={{ color: theme.text, fontSize: 17, lineHeight: 24 }}>
            {content}
          </Text>
        </Pressable>
      </View>
    );
  }

  const isError = message.id === "error";
  const stoppedEmpty = !streaming && !isError && !content.trim();
  const sources = citations.filter((citation): citation is WebCitation => citation.kind === "web");

  return (
    <View accessibilityLabel="Selrano response" style={{ gap: 10 }}>
      {isError ? (
        <View style={{ borderRadius: 14, borderWidth: 1, borderColor: theme.critical, padding: 12 }}>
          <Text style={{ color: theme.text, fontSize: 16, lineHeight: 23 }}>{content}</Text>
        </View>
      ) : stoppedEmpty ? (
        <Text style={{ color: theme.muted, fontSize: 15, fontStyle: "italic" }}>Stopped before replying.</Text>
      ) : (
        <Markdown content={content} streaming={streaming} citations={citations} />
      )}

      {!streaming && sources.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {sources.map((source) => (
            <Pressable
              key={source.marker}
              onPress={() => void Linking.openURL(source.url)}
              accessibilityRole="link"
              accessibilityLabel={`Source ${source.marker}: ${source.title}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingLeft: 4, paddingRight: 10, paddingVertical: 3 }}
            >
              <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: theme.text, fontSize: 10, fontWeight: "700" }}>{source.marker}</Text>
              </View>
              <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 13, fontWeight: "500", maxWidth: 160 }}>
                {hostname(source.url)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {saved && !isError ? (
        <View style={{ flexDirection: "row", gap: 4, marginLeft: -8 }}>
          {!stoppedEmpty ? (
            <Pressable accessibilityRole="button" accessibilityLabel={copied ? "Response copied" : "Copy response"} onPress={copy} hitSlop={6} style={{ padding: 8 }}>
              <Icon name={copied ? "checkmark" : "doc.on.doc"} size={16} color={theme.muted} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Regenerate response"
            disabled={busy}
            onPress={() => onRegenerate(message.id)}
            hitSlop={6}
            style={{ padding: 8, opacity: busy ? 0.4 : 1 }}
          >
            <Icon name="arrow.clockwise" size={16} color={theme.muted} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});
