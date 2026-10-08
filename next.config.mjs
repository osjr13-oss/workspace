import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // End-to-end tests build into their own folder so they never disturb a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingRoot: __dirname,
  serverExternalPackages: ["pdf-parse", "mammoth"]
};

export default nextConfig;
