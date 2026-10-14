import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/auth";
import { ThreadsProvider } from "@/lib/threads";
import { useTheme } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <ThreadsProvider>
            <Routes />
          </ThreadsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Routes() {
  const { session, ready } = useAuth();
  const theme = useTheme();

  // Keep the splash screen up until the saved session has been read.
  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);
  if (!ready) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: theme.background }, contentStyle: { backgroundColor: theme.background }, headerTintColor: theme.text }}>
        <Stack.Protected guard={Boolean(session)}>
          <Stack.Screen name="index" options={{ title: "Chats", headerLargeTitleEnabled: true, headerLargeTitleShadowVisible: false }} />
          <Stack.Screen name="chat/[id]" options={{ title: "", headerBackTitle: "Chats" }} />
          <Stack.Screen name="settings" options={{ title: "Settings", presentation: "formSheet", sheetAllowedDetents: [0.4], sheetGrabberVisible: true }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="signin" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
