/**
 * Package the extension for distribution (Chrome Web Store upload / sharing).
 * Run with: bun run package
 *
 * Produces dist/linktrail-<version>.zip with manifest.json at the zip root.
 * Zips ONLY the built `dist/extension` output — so source, .git, node_modules,
 * env files, and CHROMEWEBSTORE.md are never included (per CWS requirements).
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

// Fresh production build.
execSync("bun run build:ext", { stdio: "inherit" });

const out = `dist/linktrail-${version}.zip`;
execSync(`rm -f "${out}"`, { stdio: "inherit" });
execSync(`cd dist/extension && zip -qr "../linktrail-${version}.zip" .`, {
  stdio: "inherit",
  shell: "/bin/bash",
});

console.log(`\n✓ packaged ${out}`);
