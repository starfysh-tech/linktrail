/**
 * Back up the full reading history to a JSON file. Run with:
 *   bun run export [outfile]        (default: linktrail-backup.json)
 *
 * Writes the same portable shape the review app's "Export → JSON" produces, so
 * either file can be restored with `bun run import`. Dev/self-hoster ops tool —
 * uses DATABASE_URL from .env.local/.secrets.local (loaded below), like migrate.
 */
import { loadEnvLocal } from "../lib/load-env";
import { toJsonExport } from "../web/src/view";
import type { Item } from "../lib/contract";

loadEnvLocal();
const { sql } = await import("../lib/db");
const { ensureSchema } = await import("../lib/schema");

await ensureSchema();

const out = process.argv[2] ?? "linktrail-backup.json";
const rows = await sql`
  SELECT id, original_url, title, captured_at
  FROM saved_items
  ORDER BY captured_at ASC, id ASC
`;
const items: Item[] = rows.map((r) => ({
  id: r.id as string,
  url: r.original_url as string,
  title: r.title as string,
  capturedAt: new Date(r.captured_at as string).toISOString(),
}));

await Bun.write(out, toJsonExport(items, new Date().toISOString()));
console.log(`✓ exported ${items.length} item(s) → ${out}`);
