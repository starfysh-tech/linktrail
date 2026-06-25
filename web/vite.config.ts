import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin root to this config's dir so index.html + src resolve regardless of cwd.
const root = dirname(fileURLToPath(import.meta.url));

// base "/app/" + outDir web/dist/app: Vercel serves outputDirectory `web/dist`,
// so the app lands at the same-origin path /app/ alongside the /api/* functions.
// No rewrites needed; asset URLs are prefixed /app/ to match.
export default defineConfig({
  root,
  base: "/app/",
  build: { outDir: "dist/app", emptyOutDir: true },
});
