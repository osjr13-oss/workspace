// Runs the app against the offline stand-ins used by the browser tests (fake
// Supabase, AI providers and food databases), so pages can be tried without
// touching production data. Open http://localhost:3100; the fake Supabase
// accepts the test session cookie the browser tests use (e2e/support/session.ts).
import { spawn } from "node:child_process";

const mocks = spawn("node", ["e2e/support/mock-servers.mjs"], { stdio: "inherit" });
const app = spawn("npx", ["next", "dev", "-p", "3100"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_DIST_DIR: ".next-offline",
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:3100/fake-supabase",
    OFFLINE_SUPABASE_PROXY: "http://localhost:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    NEXT_PUBLIC_APP_URL: "http://localhost:3100",
    TAVILY_API_KEY: "test-tavily-key",
    TAVILY_BASE_URL: "http://localhost:54322/tavily",
    USDA_BASE_URL: "http://localhost:54322/usda",
    OFF_BASE_URL: "http://localhost:54322/off",
    GROQ_API_KEY: "test-groq-key",
    GROQ_BASE_URL: "http://localhost:54322/openai/v1",
    OPENAI_API_KEY: "test-openai-key",
    OPENAI_BASE_URL: "http://localhost:54322/gpt/v1",
    ALLOWED_EMAILS: "student@example.test",
    RESEND_API_KEY: "",
    STRIPE_SECRET_KEY: ""
  }
});

const stop = () => {
  mocks.kill();
  app.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
app.on("exit", (code) => {
  mocks.kill();
  process.exit(code ?? 0);
});
