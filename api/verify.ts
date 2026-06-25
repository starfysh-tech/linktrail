// Explicit .js extension required for Node ESM on Vercel (see api/save.ts).
import { sql } from "../lib/db.js";
import { CORS_HEADERS, preflight } from "../lib/cors.js";
import type { VerifyResponse } from "../lib/contract.js";

/** CORS preflight — the extension calls verify cross-origin with an Authorization header. */
export async function OPTIONS(): Promise<Response> {
  return preflight();
}

/**
 * Verify endpoint ("Test connection" in options): authenticate with the write
 * token, confirm the datastore is reachable, and hand the write-authenticated
 * owner their read feed URL (the read token is theirs to receive).
 */
export async function GET(req: Request): Promise<Response> {
  // Auth before any DB access so an unauthorized caller never reaches the datastore.
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.WRITE_TOKEN}`) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  // Datastore reachability: a trivial query proves the connection works.
  try {
    await sql`SELECT 1`;
  } catch {
    return json({ ok: false, error: "datastore-unreachable" }, 503);
  }

  const feedUrl = `${new URL(req.url).origin}/api/feed?token=${process.env.READ_TOKEN}`;
  return json({ ok: true, feedUrl }, 200);
}

function json(body: VerifyResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
