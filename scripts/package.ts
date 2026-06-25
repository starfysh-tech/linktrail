/**
 * Package the extension for the Chrome Web Store.
 * Run with: bun run package  →  dist/linktrail-<version>.zip
 *
 * Zips ONLY the built `dist/extension` output (no source, .git, env, docs), and
 * STRIPS the manifest `key` field: the Chrome Web Store rejects an uploaded
 * manifest that contains `key` ("key field is not allowed"). The local
 * `dist/extension` keeps its `key` so load-unpacked dev retains a stable
 * extension ID; only the zipped store build has it removed (the store assigns
 * the published key/ID).
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

// Fresh production build (dist/extension keeps `key` for load-unpacked dev).
execSync("bun run build:ext", { stdio: "inherit" });

// Stage a copy and strip `key` from the staged manifest for the store zip.
const stage = "dist/store";
execSync(`rm -rf "${stage}" && cp -R dist/extension "${stage}"`, { stdio: "inherit", shell: "/bin/bash" });
const manifestPath = `${stage}/manifest.json`;
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
delete manifest.key;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

const out = `dist/linktrail-${version}.zip`;
execSync(`rm -f "${out}" && cd "${stage}" && zip -qr "../linktrail-${version}.zip" . && cd ../.. && rm -rf "${stage}"`, {
  stdio: "inherit",
  shell: "/bin/bash",
});

console.log(`\n✓ packaged ${out} (manifest key stripped for the Web Store)`);
