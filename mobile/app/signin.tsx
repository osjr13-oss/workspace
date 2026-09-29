import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (error) {
      Alert.alert("Sign in failed", error.message);
    } else {
      router.replace("/chats");
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#ffffff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 28 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Wordmark */}
        <View style={{ marginBottom: 48 }}>
          <Text
            style={{
              fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
              fontSize: 26,
              fontWeight: "700",
              letterSpacing: -0.5,
              color: "#171717",
            }}
          >
            Selrano
          </Text>
          <Text style={{ marginTop: 8, fontSize: 15, color: "#737373", lineHeight: 22 }}>
            Sign in to your workspace.
          </Text>
        </View>

        {/* Email */}
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: "500", color: "#404040", marginBottom: 6 }}>
            Email
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: "#e5e5e5",
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: "#171717",
              backgroundColor: "#fafafa",
            }}
            placeholder="you@example.com"
            placeholderTextColor="#a3a3a3"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* Password */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 13, fontWeight: "500", color: "#404040", marginBottom: 6 }}>
            Password
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: "#e5e5e5",
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: "#171717",
              backgroundColor: "#fafafa",
            }}
            placeholder="Password"
            placeholderTextColor="#a3a3a3"
            secureTextEntry
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleSignIn}
            returnKeyType="go"
          />
        </View>

        {/* Sign In Button */}
        <TouchableOpacity
          onPress={handleSignIn}
          disabled={loading}
          style={{
            backgroundColor: "#171717",
            borderRadius: 10,
            paddingVertical: 14,
            alignItems: "center",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "600" }}>
              Sign in
            </Text>
          )}
        </TouchableOpacity>

        {/* Sign Up Link */}
        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
          <Text style={{ fontSize: 14, color: "#737373" }}>No account? </Text>
          <TouchableOpacity onPress={() => router.push("/signup")}>
            <Text style={{ fontSize: 14, color: "#171717", fontWeight: "500" }}>
              Sign up
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
