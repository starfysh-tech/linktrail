/**
 * Schema migration. Idempotent — safe to run repeatedly. Run with: bun run migrate
 *
 * Slice 2 adds the dedupe identity: a UNIQUE index on normalized_url. Because
 * the normalization policy changed (Slice 1 was basic), existing rows are first
 * re-normalized, then duplicates are collapsed (newest kept), so the unique
 * index can be created without conflict.
 */
import { loadEnvLocal } from "../lib/load-env";

loadEnvLocal();
const { sql } = await import("../lib/db");
const { normalizeUrl } = await import("../lib/normalize");

await sql`
  CREATE TABLE IF NOT EXISTS saved_items (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    original_url   text NOT NULL,
    normalized_url text NOT NULL,
    title          text NOT NULL,
    captured_at    timestamptz NOT NULL DEFAULT now()
  )
`;

// Backfill: recompute normalized_url with the current policy for any drifted rows.
const rows = await sql`SELECT id, original_url, normalized_url FROM saved_items`;
let backfilled = 0;
for (const r of rows) {
  let renorm: string;
  try {
    renorm = normalizeUrl(r.original_url as string);
  } catch {
    continue; // leave un-parseable legacy rows untouched
  }
  if (renorm !== r.normalized_url) {
    await sql`UPDATE saved_items SET normalized_url = ${renorm} WHERE id = ${r.id}`;
    backfilled++;
  }
}

// Collapse duplicates so the unique index can be created. Keep the newest row
// per normalized_url (tie-break by id).
const deleted = await sql`
  DELETE FROM saved_items a
  USING saved_items b
  WHERE a.normalized_url = b.normalized_url
    AND (a.captured_at < b.captured_at
         OR (a.captured_at = b.captured_at AND a.id < b.id))
  RETURNING a.id
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS saved_items_normalized_url_key
  ON saved_items (normalized_url)
`;

console.log(
  `✓ saved_items ready (backfilled ${backfilled}, removed ${deleted.length} duplicate row(s))`,
);
