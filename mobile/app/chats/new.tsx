import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { ChatMessage } from "../../lib/types";

const API_URL = "https://www.selrano.com/api/ai/chat";

export default function NewChatScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || streaming || !user) return;

    const userText = input.trim();
    setInput("");

    const optimisticUser: ChatMessage = {
      id: `local-${Date.now()}`,
      thread_id: threadId ?? "",
      user_id: user.id,
      role: "user",
      content: userText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setStreaming(true);

    // Add a placeholder assistant message to stream into
    const placeholderId = `streaming-${Date.now()}`;
    const placeholder: ChatMessage = {
      id: placeholderId,
      thread_id: threadId ?? "",
      user_id: user.id,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, placeholder]);

    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const body: Record<string, unknown> = {
        message: userText,
        history: messages
          .filter((m) => !m.id.startsWith("local-") && !m.id.startsWith("streaming-"))
          .map((m) => ({ role: m.role, content: m.content })),
      };
      if (threadId) body.threadId = threadId;

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || "Request failed");
      }

      // Extract thread ID from headers if new
      const newThreadId = response.headers.get("x-thread-id");
      if (newThreadId && !threadId) setThreadId(newThreadId);

      // Stream response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // Parse SSE lines
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data);
                const delta =
                  parsed?.choices?.[0]?.delta?.text ??
                  parsed?.delta?.text ??
                  parsed?.choices?.[0]?.delta?.content ??
                  "";
                if (delta) {
                  accumulated += delta;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === placeholderId ? { ...m, content: accumulated } : m
                    )
                  );
                }
              } catch {
                // plain text chunk
                if (data && data !== "[DONE]") {
                  accumulated += data;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === placeholderId ? { ...m, content: accumulated } : m
                    )
                  );
                }
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      Alert.alert("Error", msg);
      // Remove the placeholder on error
      setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
    } finally {
      setStreaming(false);
    }
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isUser = item.role === "user";
    const isStreaming = item.id.startsWith("streaming-") && item.content === "";

    return (
      <View
        style={{
          flexDirection: "row",
          justifyContent: isUser ? "flex-end" : "flex-start",
          paddingHorizontal: 16,
          paddingVertical: 6,
        }}
      >
        {isUser ? (
          <View
            style={{
              backgroundColor: "#f5f5f5",
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 10,
              maxWidth: "80%",
            }}
          >
            <Text style={{ fontSize: 15, color: "#171717", lineHeight: 22 }}>
              {item.content}
            </Text>
          </View>
        ) : (
          <View style={{ maxWidth: "92%", flex: 1 }}>
            {isStreaming ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#a3a3a3" }} />
                <Text style={{ fontSize: 13, color: "#a3a3a3" }}>Lumen is thinking...</Text>
              </View>
            ) : (
              <Text style={{ fontSize: 15, color: "#171717", lineHeight: 24 }}>
                {item.content}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#f5f5f5",
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12, padding: 4 }}>
          <Text style={{ fontSize: 15, color: "#737373" }}>Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "500", color: "#171717" }}>
            {threadId ? "Conversation" : "New conversation"}
          </Text>
          <Text style={{ fontSize: 12, color: "#a3a3a3", marginTop: 1 }}>Lumen 1</Text>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 8 }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 32 }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "600",
                  color: "#171717",
                  textAlign: "center",
                  lineHeight: 28,
                  letterSpacing: -0.3,
                }}
              >
                What are you working through?
              </Text>
              <Text style={{ fontSize: 14, color: "#a3a3a3", textAlign: "center", marginTop: 8, lineHeight: 20 }}>
                Lumen is here to help you think clearly.
              </Text>
            </View>
          }
        />

        {/* Input Bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: "#f5f5f5",
            gap: 10,
          }}
        >
          <TextInput
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#e5e5e5",
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: 10,
              fontSize: 15,
              color: "#171717",
              backgroundColor: "#fafafa",
              maxHeight: 120,
            }}
            placeholder="Message Lumen..."
            placeholderTextColor="#a3a3a3"
            multiline
            value={input}
            onChangeText={setInput}
            returnKeyType="default"
          />
          <TouchableOpacity
            onPress={sendMessage}
            disabled={!input.trim() || streaming}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: input.trim() && !streaming ? "#171717" : "#e5e5e5",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {streaming ? (
              <ActivityIndicator color="#a3a3a3" size="small" />
            ) : (
              <Text style={{ color: input.trim() ? "#ffffff" : "#a3a3a3", fontSize: 16, fontWeight: "600", marginTop: -1 }}>
                ^
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
