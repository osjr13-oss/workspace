import { useEffect } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" }}>
        <ActivityIndicator color="#171717" />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/chats" />;
  }

  return <Redirect href="/signin" />;
}
