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
            NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
            NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
            SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
            NEXT_PUBLIC_APP_URL: "http://localhost:3000",
            TAVILY_API_KEY: "test-tavily-key",
            TAVILY_BASE_URL: "http://localhost:54322/tavily",
            USDA_BASE_URL: "http://localhost:54322/usda",
            OFF_BASE_URL: "http://localhost:54322/off",
            GROQ_API_KEY: "test-groq-key",
            // Never let offline tests send customer context to a real OpenAI endpoint.
            OPENAI_API_KEY: "test-openai-key",
            OPENAI_BASE_URL: "http://localhost:54322/gpt/v1",
            ALLOWED_EMAILS: "student@example.test",
            GROQ_BASE_URL: "http://localhost:54322/openai/v1"
          }
        }
      ]
});
