import { readFileSync } from "node:fs";

/**
 * Apply one env file to process.env. Skips empty values; `override` controls
 * whether an already-set variable may be replaced.
 */
function applyFile(path: string, override: boolean): void {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return; // file absent — nothing to apply
  }
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    // Vercel exports Sensitive (write-only) vars with an EMPTY value, so an empty
    // value means "not really set" — never let it shadow a real one.
    if (value === "") continue;
    if (!override && key in process.env) continue;
    process.env[key] = value;
  }
}

/**
 * Load local env for scripts and tests.
 *
 * Two sources, in priority order:
 *  1. `.secrets.local` — the real values Vercel CANNOT pull. `vercel env pull`
 *     exports Sensitive vars (DATABASE_URL, WRITE_TOKEN, READ_TOKEN) with empty
 *     values, so the actual secrets are kept here, gitignored, and win.
 *  2. `.env.local` — the Vercel pull; supplies any non-sensitive vars and is
 *     ignored where it only has empty (sensitive) placeholders.
 *
 * No-op for any file that is absent (e.g. on Vercel, where env is injected).
 * Bun does not auto-load these, hence the explicit loader.
 */
export function loadEnvLocal(): void {
  applyFile(".secrets.local", true);
  applyFile(".env.local", false);
}
