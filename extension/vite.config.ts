import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// CRXJS resolves manifest asset paths (e.g. "src/sw.ts") relative to Vite's
// `root`, which otherwise defaults to the invocation cwd (the repo root). Pin
// `root` to this config's own directory so those paths resolve. The build still
// lands at repo-root dist/extension (outDir is relative to root).
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [crx({ manifest })],
  build: { outDir: "../dist/extension", emptyOutDir: true },
});
