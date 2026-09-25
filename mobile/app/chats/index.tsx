import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { ChatThread } from "../../lib/types";

export default function ChatsScreen() {
  const { user, signOut } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadThreads() {
    if (!user) return;
    const { data, error } = await supabase
      .from("chat_threads")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (!error && data) setThreads(data);
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(
    useCallback(() => {
      loadThreads();
    }, [user])
  );

  async function startNewChat() {
    router.push("/chats/new");
  }

  async function deleteThread(id: string) {
    Alert.alert("Delete conversation", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await supabase.from("chat_threads").delete().eq("id", id);
          setThreads((prev) => prev.filter((t) => t.id !== id));
        },
      },
    ]);
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: "short" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#171717" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: "#f5f5f5",
        }}
      >
        <Text
          style={{
            fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
            fontSize: 20,
            fontWeight: "700",
            letterSpacing: -0.4,
            color: "#171717",
          }}
        >
          Selrano
        </Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity
            onPress={startNewChat}
            style={{
              backgroundColor: "#171717",
              borderRadius: 8,
              paddingHorizontal: 14,
              paddingVertical: 7,
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600" }}>
              New chat
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={signOut}
            style={{
              borderWidth: 1,
              borderColor: "#e5e5e5",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 7,
            }}
          >
            <Text style={{ color: "#737373", fontSize: 13 }}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Thread List */}
      {threads.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 15, color: "#a3a3a3", textAlign: "center", lineHeight: 22 }}>
            No conversations yet.{"\n"}Start a new chat to work through a thought with Lumen.
          </Text>
          <TouchableOpacity
            onPress={startNewChat}
            style={{
              marginTop: 24,
              backgroundColor: "#171717",
              borderRadius: 10,
              paddingHorizontal: 24,
              paddingVertical: 12,
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}>
              Start thinking
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadThreads(); }}
              tintColor="#a3a3a3"
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/chats/${item.id}`)}
              onLongPress={() => deleteThread(item.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingVertical: 15,
                borderBottomWidth: 1,
                borderBottomColor: "#f5f5f5",
              }}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text
                  style={{ fontSize: 15, fontWeight: "500", color: "#171717" }}
                  numberOfLines={1}
                >
                  {item.title || "Untitled conversation"}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: "#a3a3a3" }}>
                {formatDate(item.updated_at)}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
