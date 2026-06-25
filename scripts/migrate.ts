/**
 * One-shot schema migration for Slice 1. Idempotent (CREATE TABLE IF NOT EXISTS).
 * Run with: bun run migrate
 *
 * Slice 1 schema is intentionally minimal — no UNIQUE constraint on
 * normalized_url yet; deduplication (unique + upsert) is Slice 2.
 */
import { loadEnvLocal } from "../lib/load-env";

loadEnvLocal();
// Dynamic import so DATABASE_URL is in the environment before lib/db reads it.
const { sql } = await import("../lib/db");

await sql`
  CREATE TABLE IF NOT EXISTS saved_items (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    original_url   text NOT NULL,
    normalized_url text NOT NULL,
    title          text NOT NULL,
    captured_at    timestamptz NOT NULL DEFAULT now()
  )
`;

console.log("✓ saved_items table ready");
