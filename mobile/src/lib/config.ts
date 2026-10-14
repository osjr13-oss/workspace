/** Public settings baked into the app at build time (see mobile/.env.example). */
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
  apiUrl: (process.env.EXPO_PUBLIC_API_URL || "https://www.selrano.com").replace(/\/$/, "")
};

export const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
