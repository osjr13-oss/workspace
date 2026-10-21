import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // End-to-end tests build into their own folder so they never disturb a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingRoot: __dirname,
  // Offline previews only (scripts/dev-offline.mjs): the fake Supabase is served
  // through the app's own origin, since some embedded browsers block other ports.
  ...(process.env.OFFLINE_SUPABASE_PROXY
    ? { rewrites: async () => [{ source: "/fake-supabase/:path*", destination: `${process.env.OFFLINE_SUPABASE_PROXY}/:path*` }] }
    : {})
};

export default nextConfig;
