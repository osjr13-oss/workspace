import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth";
import { checkAccess, NoAccessError } from "@/lib/api";
import { configured } from "@/lib/config";
import { useTheme } from "@/lib/theme";

export default function SignIn() {
  const theme = useTheme();
  const { signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(configured ? "" : "This build is missing its Supabase settings (see mobile/.env.example).");

  async function submit() {
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setMessage("");
    const failure = await signIn(email, password);
    if (failure) {
      setMessage(failure);
      setBusy(false);
      return;
    }
    // Selrano is private: only allowlisted accounts may stay signed in.
    try {
      await checkAccess();
    } catch (error) {
      await signOut();
      setMessage(error instanceof NoAccessError ? "That account does not have access to Selrano." : error instanceof Error ? error.message : "Could not reach Selrano.");
    }
    setBusy(false);
  }

  const field = { backgroundColor: theme.surface, color: theme.text, borderRadius: 14, paddingHorizontal: 16, height: 52, fontSize: 17 } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 12 }}>
        <Text style={{ color: theme.text, fontSize: 34, fontWeight: "700", letterSpacing: -0.6 }}>Selrano</Text>
        <Text style={{ color: theme.muted, fontSize: 17, marginBottom: 20 }}>Sign in with your approved account.</Text>
        <TextInput
          accessibilityLabel="Email address"
          placeholder="Email"
          placeholderTextColor={theme.faint}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          value={email}
          onChangeText={setEmail}
          style={field}
        />
        <TextInput
          accessibilityLabel="Password"
          placeholder="Password"
          placeholderTextColor={theme.faint}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          returnKeyType="go"
          style={field}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          onPress={submit}
          disabled={busy}
          style={{ backgroundColor: theme.accent, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? <ActivityIndicator color={theme.onAccent} /> : <Text style={{ color: theme.onAccent, fontSize: 17, fontWeight: "600" }}>Sign in</Text>}
        </Pressable>
        {message ? <Text style={{ color: theme.critical, fontSize: 15, marginTop: 4 }}>{message}</Text> : null}
        <View style={{ height: 40 }} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
