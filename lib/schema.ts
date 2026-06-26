// Explicit .js extension: this is deployed code (imported by api/*), and Node
// ESM on Vercel does not resolve extensionless relative imports at runtime.
import { sql } from "./db.js";

/**
 * Lazy, idempotent schema bootstrap so a brand-new (empty) Neon database works
 * with zero manual migration — every DB-touching endpoint awaits this before its
 * first query (see docs/issues/07-self-hosting.md). The unique index in
 * particular must exist before save's `ON CONFLICT (normalized_url)`.
 *
 * The heavy backfill/dedupe migration stays in scripts/migrate.ts (dev only);
 * this is only the create-if-absent path a fresh self-host deploy needs.
 */

/** The real DDL: create the table and the dedupe unique index, both idempotent. */
async function runDdl(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS saved_items (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      original_url   text NOT NULL,
      normalized_url text NOT NULL,
      title          text NOT NULL,
      captured_at    timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS saved_items_normalized_url_key
    ON saved_items (normalized_url)
  `;
  // Single-row config holding the backend's tokens for env-less (zero-input)
  // deploys. The id=1 singleton + CHECK means there is at most one row, so the
  // first-run claim is an atomic INSERT ... ON CONFLICT (id) DO NOTHING.
  await sql`
    CREATE TABLE IF NOT EXISTS config (
      id          int PRIMARY KEY DEFAULT 1,
      write_token text NOT NULL,
      read_token  text NOT NULL,
      claimed_at  timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT config_singleton CHECK (id = 1)
    )
  `;
}

// Memo: the DDL runs at most once per process. We cache the in-flight promise
// (not a boolean) so concurrent callers await the same run rather than racing
// to issue duplicate DDL. Reset to null on failure so a transient error can be
// retried by the next request instead of poisoning the instance permanently.
let memo: Promise<void> | null = null;

/**
 * Ensure the schema exists. Memoized per process: the runner is invoked at most
 * once across all (including concurrent) calls.
 *
 * @param run injected DDL runner — defaults to the real `sql`-backed DDL so the
 *   memoization can be unit-tested with a fake runner and no database.
 */
export function ensureSchema(run: () => Promise<void> = runDdl): Promise<void> {
  if (!memo) {
    memo = run().catch((err) => {
      memo = null; // allow a later request to retry after a transient failure
      throw err;
    });
  }
  return memo;
}

/** Test-only: clear the memo so each memoization test starts from a clean slate. */
export function resetSchemaMemoForTests(): void {
  memo = null;
}
