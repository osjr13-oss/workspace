import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ucuppqutbzbwekyxrkwr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjdXBwcXV0Ynpid2VreXhya3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODc3NDEsImV4cCI6MjA5NTY2Mzc0MX0.Sp49Z6AZF283j-AUT1OwBy_ki_5hIfJyj9qfn4IFSCo";

// Secure session storage using device Keychain on iOS
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
