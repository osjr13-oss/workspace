import { useRef } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/lib/theme";
import { removeEmDashes } from "@shared/text";
import type { Project } from "@shared/types";

export type Attachment = {
  key: string;
  name: string;
  status: "uploading" | "ready" | "failed";
  fileId?: string;
  error?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
  onSend: () => void;
  onStop: () => void;
  onAttach: (source: "camera" | "photos" | "files") => void;
  attachments: Attachment[];
  onRemoveAttachment: (key: string) => void;
  maxAttachments: number;
  projects: Project[];
  projectId: string;
  onProjectChange: (projectId: string) => void;
  /** An existing conversation keeps the project it started with. */
  projectLocked: boolean;
};

export function Composer(props: Props) {
  const theme = useTheme();
  const input = useRef<TextInput>(null);
  const uploading = props.attachments.some((item) => item.status === "uploading");
  const canSend = Boolean(props.value.trim()) && !uploading;
  const projectName = props.projects.find((project) => project.id === props.projectId)?.name;

  function chooseSource() {
    if (props.attachments.length >= props.maxAttachments) {
      Alert.alert("Attachment limit", `Up to ${props.maxAttachments} files per message.`);
      return;
    }
    const options = ["Take Photo", "Photo Library", "Choose File", "Cancel"];
    const sources = ["camera", "photos", "files"] as const;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 3 }, (index) => {
        if (index < 3) props.onAttach(sources[index]);
      });
    } else {
      props.onAttach("files");
    }
  }

  function chooseProject() {
    if (props.projectLocked) return;
    const options = ["No project", ...props.projects.map((project) => project.name), "Cancel"];
    const pick = (index: number) => {
      if (index === options.length - 1) return;
      props.onProjectChange(index === 0 ? "" : props.projects[index - 1].id);
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1, title: "Use a project's notes and files" }, pick);
    } else {
      Alert.alert("Project", undefined, options.slice(0, -1).map((label, index) => ({ text: label, onPress: () => pick(index) })));
    }
  }

  return (
    <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 24, backgroundColor: theme.elevated, paddingTop: 4, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } }}>
      {props.attachments.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 10, paddingTop: 8 }}>
          {props.attachments.map((item) => (
            <View
              key={item.key}
              accessibilityLabel={`${item.name}, ${item.status === "uploading" ? "uploading" : item.status === "failed" ? "failed" : "attached"}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: item.status === "failed" ? theme.critical : theme.border, borderRadius: 12, paddingLeft: 10, paddingRight: 4, paddingVertical: 5 }}
            >
              {item.status === "uploading" ? <ActivityIndicator size="small" color={theme.muted} /> : <Icon name="doc.text" size={14} color={item.status === "failed" ? theme.critical : theme.muted} />}
              <Text numberOfLines={1} style={{ color: theme.text, fontSize: 13, fontWeight: "500", maxWidth: 150 }}>
                {item.name}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} hitSlop={8} onPress={() => props.onRemoveAttachment(item.key)} style={{ padding: 4 }}>
                <Icon name="xmark" size={11} color={theme.muted} weight="semibold" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <TextInput
        ref={input}
        accessibilityLabel="Chat message"
        value={props.value}
        onChangeText={(text) => props.onChange(removeEmDashes(text))}
        placeholder="Ask Selrano anything"
        placeholderTextColor={theme.faint}
        multiline
        style={{ color: theme.text, fontSize: 17, lineHeight: 22, maxHeight: 160, minHeight: 40, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingBottom: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Attach" onPress={chooseSource} hitSlop={6} style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }}>
          <Icon name="plus" size={19} color={theme.text} weight="medium" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Project: ${projectName || "No project"}`}
          accessibilityState={{ disabled: props.projectLocked }}
          onPress={chooseProject}
          style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: props.projectLocked ? 0 : 1, borderColor: theme.border, paddingHorizontal: 10, height: 30 }}
        >
          <Icon name="folder" size={13} color={theme.muted} />
          <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 13, fontWeight: "500", maxWidth: 150 }}>
            {projectName || "No project"}
          </Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        {props.busy ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Stop responding" onPress={props.onStop} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center" }}>
            <Icon name="stop.fill" size={12} color={theme.onAccent} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={props.onSend}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.accent, opacity: canSend ? 1 : 0.25, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="arrow.up" size={17} color={theme.onAccent} weight="semibold" />
          </Pressable>
        )}
      </View>
    </View>
  );
}
