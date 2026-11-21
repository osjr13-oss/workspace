import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

// Local runs start offline stand-ins for Supabase and Groq (e2e/support) plus the
// real app pointed at them, so no accounts or network are needed.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
    // For machines whose preinstalled Chromium does not match this Playwright version.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: "node e2e/support/mock-servers.mjs",
          url: "http://localhost:54322/__requests",
          stdout: "ignore",
          reuseExistingServer: true
        },
        {
          // A production build: no hot-reload noise, and the same code paths real visitors get.
          command: process.env.E2E_DEV ? "npm run dev" : "npm run build && npm run start",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 300_000,
          env: {
            NEXT_DIST_DIR: process.env.E2E_DEV ? ".next" : ".next-e2e",
            // Selrano is private: only the fake test account may sign in.
            ALLOWED_EMAILS: "student@example.test",
            // Gmail and Google Calendar stand-ins on the fake Groq port.
            GOOGLE_CLIENT_ID: "test-google-client",
            GOOGLE_CLIENT_SECRET: "test-google-secret",
            GOOGLE_OAUTH_URL: "http://localhost:54322/google/auth",
            GOOGLE_TOKEN_URL: "http://localhost:54322/google/token",
            GOOGLE_REVOKE_URL: "http://localhost:54322/google/revoke",
            GOOGLE_API_BASE: "http://localhost:54322/google/api",
            // Plaid stand-in on the fake Groq port.
            PLAID_CLIENT_ID: "test-plaid-client",
            PLAID_SECRET: "test-plaid-secret",
            PLAID_ENV: "sandbox",
            PLAID_BASE_URL: "http://localhost:54322/plaid",
            NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
            NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
            SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
            NEXT_PUBLIC_APP_URL: "http://localhost:3000",
            EXA_API_KEY: "test-exa-key",
            EXA_BASE_URL: "http://localhost:54322/exa",
            GROQ_API_KEY: "test-groq-key",
            // Never let offline tests send customer context to a real OpenAI endpoint.
            OPENAI_API_KEY: "test-openai-key",
            // Empty values beat any real keys in .env.local, so tests never call Google or a real
            // embedding service. e2e/gemini.spec.ts tests the Gemini client against the fake server.
            GEMINI_API_KEY: "",
            EMBEDDING_API_KEY: "",
            OPENAI_BASE_URL: "http://localhost:54322/gpt/v1",
            GROQ_BASE_URL: "http://localhost:54322/openai/v1"
          }
        }
      ]
});
