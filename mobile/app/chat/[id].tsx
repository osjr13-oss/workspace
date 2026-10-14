import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createStreamPacer, type StreamPacer } from "@shared/stream-pacer";
import { removeEmDashes } from "@shared/text";
import type { ChatMessage } from "@shared/types";
import { useAuth } from "@/auth";
import { Composer, type Attachment } from "@/components/Composer";
import { Icon } from "@/components/Icon";
import { MessageView, type DisplayMessage } from "@/components/MessageView";
import { Thinking } from "@/components/Thinking";
import { NoAccessError, stopReply, streamChat, uploadFile, type ChatRequest, type PickedFile } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useThreads } from "@/lib/threads";
import { useTheme } from "@/lib/theme";

type Handoff = { userKey?: string | null; assistantKey?: string | null };

const MAX_ATTACHMENTS = 4;

const STARTERS = [
  { title: "Summarize my notes", prompt: "Summarize what is in my notes and point out anything I should follow up on." },
  { title: "Quiz me", prompt: "Quiz me on what I have been studying. Ask one question at a time." },
  { title: "Make flashcards", prompt: "Turn my latest notes into a flashcard deck." },
  { title: "What changed today", prompt: "What are the most important news stories today?" }
];

/** The streamed bubble keeps its key when the saved row replaces it, so nothing remounts or flickers. */
function withHandoffKeys(rows: ChatMessage[], handoff?: Handoff): DisplayMessage[] {
  const out: DisplayMessage[] = rows.map((row) => ({ ...row }));
  if (!handoff) return out;
  let assistantIndex = -1;
  for (let i = out.length - 1; i >= 0; i -= 1) {
    if (out[i].role === "assistant") {
      assistantIndex = i;
      break;
    }
  }
  if (assistantIndex >= 0 && handoff.assistantKey) out[assistantIndex].clientKey = handoff.assistantKey;
  if (handoff.userKey) {
    for (let i = (assistantIndex >= 0 ? assistantIndex : out.length) - 1; i >= 0; i -= 1) {
      if (out[i].role === "user") {
        out[i].clientKey = handoff.userKey;
        break;
      }
    }
  }
  return out;
}

export default function Conversation() {
  const theme = useTheme();
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();
  const initialThread = params.id && params.id !== "new" ? params.id : null;
  const { threads, projects, refresh: refreshThreads, rename, remove } = useThreads();

  const [threadId, setThreadIdState] = useState<string | null>(initialThread);
  const threadIdRef = useRef<string | null>(initialThread);
  const setThreadId = (id: string | null) => {
    threadIdRef.current = id;
    setThreadIdState(id);
  };
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(Boolean(initialThread));
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [replyStarted, setReplyStarted] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);

  const listRef = useRef<FlatList<DisplayMessage>>(null);
  const turnRef = useRef(0);
  // Only one reply can be in flight; checked synchronously so a double tap cannot start two.
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const pacerRef = useRef<StreamPacer | null>(null);
  const turnKeysRef = useRef<Handoff>({});
  const stopRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);

  const activeThread = threads.find((thread) => thread.id === threadId) || null;

  const loadMessages = useCallback(async (id: string | null, handoff?: Handoff) => {
    if (!id) {
      setMessages([]);
      setLoadingThread(false);
      return;
    }
    const { data } = await supabase.from("chat_messages").select("*").eq("thread_id", id).order("created_at", { ascending: true });
    if (!mountedRef.current) return;
    setMessages(withHandoffKeys((data as ChatMessage[]) || [], handoff));
    setLoadingThread(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (initialThread) void loadMessages(initialThread);
    return () => {
      // Leaving mid-reply: the website keeps generating and saves the answer.
      mountedRef.current = false;
      abortRef.current?.abort();
      pacerRef.current?.cancel();
    };
  }, [initialThread, loadMessages]);

  useEffect(() => {
    if (activeThread) setProjectId(activeThread.project_id || "");
  }, [activeThread]);

  const handleNoAccess = useCallback(
    async (error: unknown) => {
      if (!(error instanceof NoAccessError)) return false;
      Alert.alert("Signed out", "This account does not have access to Selrano.");
      await signOut();
      return true;
    },
    [signOut]
  );

  useLayoutEffect(() => {
    const title = threadId ? removeEmDashes(activeThread?.title || "") || "Conversation" : "New chat";
    navigation.setOptions({
      title,
      headerRight: threadId
        ? () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Conversation options" hitSlop={10} onPress={manageThread}>
              <Icon name="ellipsis" size={20} color={theme.text} />
            </Pressable>
          )
        : undefined
    });
  });

  function manageThread() {
    const id = threadIdRef.current;
    if (!id) return;
    const current = removeEmDashes(activeThread?.title || "");
    ActionSheetIOS.showActionSheetWithOptions({ options: ["Rename", "Delete", "Cancel"], destructiveButtonIndex: 1, cancelButtonIndex: 2 }, (index) => {
      if (index === 0) {
        Alert.prompt(
          "Rename chat",
          undefined,
          async (next) => {
            const failure = await rename(id, next);
            if (failure) Alert.alert("Could not rename", failure);
          },
          "plain-text",
          current
        );
      }
      if (index === 1) {
        Alert.alert("Delete this chat?", current, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              const failure = await remove(id);
              if (failure) Alert.alert("Could not delete", failure);
              else router.back();
            }
          }
        ]);
      }
    });
  }

  async function requestReply(options: ChatRequest, userKey: string | null = null, sentAttachments: Attachment[] = []) {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await runReply(options, userKey, sentAttachments);
    } finally {
      busyRef.current = false;
    }
  }

  async function runReply(options: ChatRequest, userKey: string | null, sentAttachments: Attachment[]) {
    setLoading(true);
    setReplyStarted(false);
    setStatus(null);
    turnRef.current += 1;
    const assistantKey = `streaming-${turnRef.current}`;
    turnKeysRef.current = { userKey, assistantKey };
    const controller = new AbortController();
    abortRef.current = controller;
    const live = () => mountedRef.current && !controller.signal.aborted;
    // Words are revealed at a steady pace instead of in the bursts they arrive in.
    const pacer = createStreamPacer((visible) => {
      if (!mountedRef.current) return;
      if (visible.trim()) setReplyStarted(true);
      setMessages((existing) => existing.map((item) => (item.id === "streaming" ? { ...item, content: visible } : item)));
    });
    pacerRef.current = pacer;
    const canRestoreText = !options.editMessageId && !options.regenerateMessageId;
    const startingThreadId = threadIdRef.current;
    let streamThreadId = startingThreadId;
    let bubbleAdded = false;
    let failed = false;

    // A reply that could not be produced leaves nothing behind on the server, so
    // the user's own message comes off the screen and goes back in the box.
    const fail = (message: string, restore: boolean) => {
      failed = true;
      pacer.cancel();
      setMessages((existing) => [
        ...existing.filter((item) => item.id !== "pending-user" && item.id !== "streaming"),
        { id: "error", thread_id: threadIdRef.current || "pending", user_id: "", role: "assistant", content: message, created_at: new Date().toISOString() }
      ]);
      if (restore && canRestoreText && options.message) {
        setText((existing) => existing || options.message || "");
        if (sentAttachments.length) setAttachments((existing) => (existing.length ? existing : sentAttachments));
      }
      setReplyStarted(false);
      setStatus(null);
      setLoading(false);
    };

    try {
      await streamChat(
        { ...options, threadId: threadIdRef.current, projectId: projectId || null },
        (event) => {
          if (!live()) return;
          if (event.type === "start") {
            streamThreadId = event.threadId;
            if (event.threadId !== threadIdRef.current) {
              setThreadId(event.threadId);
              void refreshThreads();
            }
          } else if (event.type === "status") {
            setStatus(event.label);
          } else if (event.type === "text") {
            if (!bubbleAdded) {
              bubbleAdded = true;
              setStatus(null);
              setMessages((existing) => [
                ...existing,
                { id: "streaming", clientKey: assistantKey, thread_id: streamThreadId || "pending", user_id: "", role: "assistant", content: "", created_at: new Date().toISOString() }
              ]);
            }
            pacer.push(event.text);
          } else if (event.type === "error") {
            fail(event.error, event.restore);
          }
        },
        controller.signal
      );
      if (!live()) return;
      if (failed) {
        // The website removed a conversation this turn had just created.
        if (streamThreadId && streamThreadId !== startingThreadId) {
          setThreadId(startingThreadId);
          void refreshThreads();
        }
        return;
      }
      await pacer.finish();
      if (!live() || stopRef.current) return;
      await loadMessages(streamThreadId, { userKey, assistantKey });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReplyStarted(false);
      setStatus(null);
      setLoading(false);
      void refreshThreads();
    } catch (error) {
      pacer.cancel();
      if (stopRef.current) {
        await stopRef.current;
        return;
      }
      if (controller.signal.aborted || !mountedRef.current) return;
      if (await handleNoAccess(error)) return;
      if (bubbleAdded) {
        // The connection dropped mid-reply. The website finishes and saves the answer.
        setReplyStarted(false);
        setStatus(null);
        setLoading(false);
        setTimeout(() => void loadMessages(streamThreadId, { userKey, assistantKey }), 2500);
        return;
      }
      fail(error instanceof Error ? error.message : "Network error. Please try again.", true);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (pacerRef.current === pacer) pacerRef.current = null;
    }
  }

  /** Stop: keep the words already on screen as the reply, and save exactly those. */
  function stop() {
    const controller = abortRef.current;
    if (!controller || stopRef.current) return;
    const partial = pacerRef.current?.shown() ?? "";
    pacerRef.current?.cancel();
    const id = threadIdRef.current;
    const keys = turnKeysRef.current;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const finish = async () => {
      setStatus(null);
      setMessages((existing) => existing.map((item) => (item.id === "streaming" ? { ...item, content: partial } : item)));
      if (id) {
        await stopReply(id, partial).catch(() => undefined);
        await loadMessages(id, keys);
        void refreshThreads();
      }
      setReplyStarted(false);
      setLoading(false);
    };
    stopRef.current = finish().finally(() => {
      stopRef.current = null;
    });
    controller.abort();
  }

  async function send() {
    const prompt = removeEmDashes(text).trim();
    if (!prompt || busyRef.current) return;
    if (attachments.some((item) => item.status === "uploading")) return;
    const ready = attachments.filter((item) => item.status === "ready" && item.fileId);
    setText("");
    setAttachments([]);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    const userKey = `pending-user-${turnRef.current + 1}`;
    setMessages((existing) => [
      ...existing.filter((item) => item.id !== "error"),
      {
        id: "pending-user",
        clientKey: userKey,
        thread_id: threadIdRef.current || "pending",
        user_id: "",
        role: "user",
        content: prompt,
        citations: ready.map((item, index) => ({ kind: "file" as const, marker: `attachment-${index + 1}`, fileId: item.fileId!, fileName: item.name, pageNumber: null, charStart: null, charEnd: null })),
        created_at: new Date().toISOString()
      }
    ]);
    await requestReply({ message: prompt, fileIds: ready.map((item) => item.fileId!) }, userKey, ready);
  }

  function editAndResend(message: DisplayMessage) {
    if (busyRef.current) return;
    Alert.prompt(
      "Edit message",
      "The conversation continues from the edited message.",
      async (next) => {
        const content = removeEmDashes(next || "").trim();
        if (!content || content === message.content) return;
        setMessages((existing) => {
          const index = existing.findIndex((item) => item.id === message.id);
          return index === -1 ? existing : existing.slice(0, index + 1).map((item) => (item.id === message.id ? { ...item, content } : item));
        });
        await requestReply({ message: content, editMessageId: message.id });
      },
      "plain-text",
      message.content
    );
  }

  async function regenerate(messageId: string) {
    if (busyRef.current) return;
    setMessages((existing) => {
      const index = existing.findIndex((item) => item.id === messageId);
      return index === -1 ? existing : existing.slice(0, index);
    });
    await requestReply({ regenerateMessageId: messageId });
  }

  async function attach(source: "camera" | "photos" | "files") {
    const room = MAX_ATTACHMENTS - attachments.length;
    let picked: PickedFile[] = [];
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Camera access is off", "Turn it on in Settings to photograph pages.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 });
      if (result.canceled) return;
      picked = result.assets.map((asset) => ({ uri: asset.uri, name: `photo-${Date.now()}.jpg`, mimeType: "image/jpeg", size: asset.fileSize }));
    } else if (source === "photos") {
      // A compressed JPEG keeps photos under the size the website can read.
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsMultipleSelection: true, selectionLimit: room });
      if (result.canceled) return;
      picked = result.assets.map((asset, index) => ({ uri: asset.uri, name: `photo-${Date.now()}-${index + 1}.jpg`, mimeType: "image/jpeg", size: asset.fileSize }));
    } else {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown", "image/*"],
        multiple: true,
        copyToCacheDirectory: true
      });
      if (result.canceled) return;
      picked = result.assets.map((asset) => ({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType || "application/octet-stream", size: asset.size }));
    }

    for (const file of picked.slice(0, room)) {
      const key = `${file.name}-${Math.random().toString(36).slice(2, 8)}`;
      setAttachments((existing) => [...existing, { key, name: file.name, status: "uploading" }]);
      // Attachments are saved to the workspace (in this chat's project), like uploads on the website.
      uploadFile(file, projectId || null)
        .then((fileId) => setAttachments((existing) => existing.map((item) => (item.key === key ? { ...item, status: "ready", fileId } : item))))
        .catch(async (error: unknown) => {
          if (await handleNoAccess(error)) return;
          const message = error instanceof Error ? error.message : "Upload failed.";
          setAttachments((existing) => existing.map((item) => (item.key === key ? { ...item, status: "failed", error: message } : item)));
          Alert.alert("Could not attach", message);
        });
    }
  }

  const empty = !messages.length && !loadingThread;
  const reversed = [...messages].reverse();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={headerHeight} style={{ flex: 1, backgroundColor: theme.background }}>
      {loadingThread ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.muted} />
        </View>
      ) : empty ? (
        <View style={{ flex: 1, justifyContent: "flex-end", paddingHorizontal: 20, paddingBottom: 16, gap: 8 }}>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: "700", letterSpacing: -0.5, marginBottom: 8 }}>What are we working on?</Text>
          {STARTERS.map((starter) => (
            <Pressable
              key={starter.title}
              accessibilityRole="button"
              onPress={() => setText(starter.prompt)}
              style={({ pressed }) => ({ backgroundColor: pressed ? theme.border : theme.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 })}
            >
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>{starter.title}</Text>
              <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 14, marginTop: 2 }}>
                {starter.prompt}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          inverted
          data={reversed}
          keyExtractor={(item) => item.clientKey ?? item.id}
          renderItem={({ item }) => <MessageView message={item} busy={loading} onEdit={editAndResend} onRegenerate={regenerate} />}
          // In an inverted list the header sits at the bottom, under the newest message.
          ListHeaderComponent={loading && !replyStarted ? <Thinking status={status} /> : null}
          ItemSeparatorComponent={() => <View style={{ height: 22 }} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
          keyboardDismissMode="interactive"
          // Keeps what the reader is looking at still while the newest reply grows below it.
          maintainVisibleContentPosition={{ minIndexForVisible: 1, autoscrollToTopThreshold: 60 }}
          onScroll={(event) => setShowJump(event.nativeEvent.contentOffset.y > 240)}
          scrollEventThrottle={100}
        />
      )}

      {showJump && !empty ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Jump to latest"
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          style={{ position: "absolute", alignSelf: "center", bottom: 150 + insets.bottom, width: 36, height: 36, borderRadius: 18, backgroundColor: theme.elevated, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="arrow.down" size={16} color={theme.text} />
        </Pressable>
      ) : null}

      <View style={{ paddingHorizontal: 10, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 10) }}>
        <Composer
          value={text}
          onChange={setText}
          busy={loading}
          onSend={send}
          onStop={stop}
          onAttach={attach}
          attachments={attachments}
          onRemoveAttachment={(key) => setAttachments((existing) => existing.filter((item) => item.key !== key))}
          maxAttachments={MAX_ATTACHMENTS}
          projects={projects}
          projectId={projectId}
          onProjectChange={setProjectId}
          projectLocked={Boolean(threadId)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
