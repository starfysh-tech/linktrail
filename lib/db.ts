import { neon } from "@neondatabase/serverless";

/**
 * Neon serverless Postgres client over the HTTP driver — well-suited to
 * Vercel Functions (no pooled connection to manage). Backend-only; never
 * imported by the extension.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set (run `vercel env pull .env.local`).");
}

export const sql = neon(connectionString);
