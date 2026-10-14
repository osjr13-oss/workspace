import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

// The session lives in the iPhone Keychain. Keychain items are best kept under
// about 2 KB, and a Supabase session can be larger, so it is stored in chunks.
const CHUNK = 1800;

const keychain = {
  async getItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(`${key}.n`));
    if (!count) return SecureStore.getItemAsync(key);
    const parts = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)));
    return parts.some((part) => part === null) ? null : parts.join("");
  },
  async setItem(key: string, value: string) {
    await keychain.removeItem(key);
    const parts = value.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, "g")) || [""];
    await Promise.all(parts.map((part, i) => SecureStore.setItemAsync(`${key}.${i}`, part)));
    await SecureStore.setItemAsync(`${key}.n`, String(parts.length));
  },
  async removeItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(`${key}.n`));
    await Promise.all([
      SecureStore.deleteItemAsync(key),
      SecureStore.deleteItemAsync(`${key}.n`),
      ...Array.from({ length: count || 0 }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`))
    ]);
  }
};

// The browser preview (used only to look at screens during development) has no Keychain.
const storage = Platform.OS === "web" ? undefined : keychain;

export const supabase = createClient(config.supabaseUrl || "https://not-configured.invalid", config.supabaseAnonKey || "missing", {
  auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
});

// Refresh the session only while the app is in the foreground.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
