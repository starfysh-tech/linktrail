/**
 * Dev convenience: empty the saved_items table. Run with: bun run reset
 *
 * Destructive — wipes ALL captures. Intended for clearing disposable test data
 * during development, not for production use once real captures matter.
 */
import { loadEnvLocal } from "../lib/load-env";

loadEnvLocal();
const { sql } = await import("../lib/db");

await sql`TRUNCATE TABLE saved_items`;
console.log("✓ saved_items truncated (all rows removed)");
