import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Public prerendered pages and icons ship with the build. Signed-in pages are dynamic.
export default defineCloudflareConfig({ incrementalCache: staticAssetsCache });
