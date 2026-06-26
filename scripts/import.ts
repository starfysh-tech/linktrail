/**
 * Restore (or migrate) a reading history from a JSON backup. Run with:
 *   bun run import <file.json>
 *
 * Reads a file produced by `bun run export` or the review app's JSON export
 * (accepts either the {linktrail, items} envelope or a bare items array).
 * Idempotent: each row is re-normalized via the SHARED lib/normalize and upserted
 * with ON CONFLICT DO NOTHING, so re-running adds only what's missing — safe for
 * backend-to-backend migration. Ensures the schema first, so it works on a fresh DB.
 */
import { loadEnvLocal } from "../lib/load-env";
import type { ExportFile } from "../web/src/view";

loadEnvLocal();
const { sql } = await import("../lib/db");
const { normalizeUrl } = await import("../lib/normalize");
const { ensureSchema } = await import("../lib/schema");

const file = process.argv[2];
if (!file) {
  console.error("usage: bun run import <file.json>");
  process.exit(1);
}

const parsed = JSON.parse(await Bun.file(file).text()) as ExportFile | ExportFile["items"];
const items = Array.isArray(parsed) ? parsed : parsed.items;

await ensureSchema();

let inserted = 0;
let skipped = 0;
let invalid = 0;
for (const it of items) {
  let normalized: string;
  try {
    normalized = normalizeUrl(it.url);
  } catch {
    invalid++; // unparseable URL — can't dedupe it, leave it out
    continue;
  }
  const title = (it.title ?? "").trim() || new URL(normalized).hostname;
  const capturedAt = it.capturedAt ?? new Date().toISOString();
  const res = await sql`
    INSERT INTO saved_items (original_url, normalized_url, title, captured_at)
    VALUES (${it.url}, ${normalized}, ${title}, ${capturedAt})
    ON CONFLICT (normalized_url) DO NOTHING
    RETURNING id
  `;
  if (res.length > 0) inserted++;
  else skipped++;
}

console.log(`✓ import: ${inserted} added, ${skipped} already present, ${invalid} skipped (unparseable)`);
