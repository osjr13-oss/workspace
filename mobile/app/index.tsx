import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { ActionSheetIOS, Alert, Platform, Pressable, RefreshControl, SectionList, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { removeEmDashes } from "@shared/text";
import type { ChatThread } from "@shared/types";
import { Icon } from "@/components/Icon";
import { groupThreads, useThreads } from "@/lib/threads";
import { useTheme } from "@/lib/theme";

export default function Chats() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { threads, loaded, refresh, rename, remove } = useThreads();
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={10} onPress={() => router.push("/settings")}>
          <Icon name="person.crop.circle" size={22} color={theme.text} />
        </Pressable>
      ),
      headerRight: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="New chat" hitSlop={10} onPress={() => router.push("/chat/new")}>
          <Icon name="square.and.pencil" size={21} color={theme.text} />
        </Pressable>
      ),
      headerSearchBarOptions: {
        placeholder: "Search chats",
        hideWhenScrolling: true,
        onChangeText: (event: { nativeEvent: { text: string } }) => setQuery(event.nativeEvent.text)
      }
    });
  }, [navigation, theme]);

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return groupThreads(needle ? threads.filter((thread) => thread.title.toLowerCase().includes(needle)) : threads);
  }, [threads, query]);

  function manage(thread: ChatThread) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const title = removeEmDashes(thread.title) || "Untitled chat";
    const confirmDelete = () =>
      Alert.alert("Delete this chat?", title, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const failure = await remove(thread.id);
            if (failure) Alert.alert("Could not delete", failure);
          }
        }
      ]);
    const renameChat = () =>
      Alert.prompt(
        "Rename chat",
        undefined,
        async (next) => {
          const failure = await rename(thread.id, next);
          if (failure) Alert.alert("Could not rename", failure);
        },
        "plain-text",
        title
      );
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ title, options: ["Rename", "Delete", "Cancel"], destructiveButtonIndex: 1, cancelButtonIndex: 2 }, (index) => {
        if (index === 0) renameChat();
        if (index === 1) confirmDelete();
      });
    } else {
      confirmDelete();
    }
  }

  return (
    <SectionList
      contentInsetAdjustmentBehavior="automatic"
      sections={sections}
      keyExtractor={(thread) => thread.id}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          }}
        />
      }
      renderSectionHeader={({ section }) => (
        <Text style={{ color: theme.muted, fontSize: 13, fontWeight: "600", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Long press to rename or delete"
          onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id } })}
          onLongPress={() => manage(item)}
          style={({ pressed }) => ({ paddingHorizontal: 20, paddingVertical: 13, backgroundColor: pressed ? theme.surface : "transparent" })}
        >
          <Text numberOfLines={1} style={{ color: theme.text, fontSize: 17 }}>
            {removeEmDashes(item.title) || "Untitled chat"}
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={
        loaded ? (
          <View style={{ paddingHorizontal: 24, paddingTop: 80, alignItems: "center", gap: 14 }}>
            <Text style={{ color: theme.muted, fontSize: 17, textAlign: "center" }}>{query ? "No chats match." : "Your conversations will appear here."}</Text>
            {!query ? (
              <Pressable accessibilityRole="button" onPress={() => router.push("/chat/new")} style={{ backgroundColor: theme.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12 }}>
                <Text style={{ color: theme.onAccent, fontSize: 16, fontWeight: "600" }}>Start a chat</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null
      }
      contentContainerStyle={{ paddingBottom: 40 }}
      style={{ backgroundColor: theme.background }}
    />
  );
}
