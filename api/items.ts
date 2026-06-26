// Explicit .js extensions required for Node ESM on Vercel (see api/save.ts).
import { sql } from "../lib/db.js";
import { ensureSchema } from "../lib/schema.js";
import { getTokens } from "../lib/config.js";
import { CORS_HEADERS, preflight } from "../lib/cors.js";
import type { Item } from "../lib/contract.js";

/** CORS preflight — same-origin in production, but kept for parity/local dev. */
export async function OPTIONS(): Promise<Response> {
  return preflight();
}

/**
 * Items endpoint: the review web app's full-history read.
 *
 * Read-token auth via the `?token=` query (same convention as api/feed.ts — the
 * read token is the owner's to hold). Returns the entire history as JSON,
 * newest-first; the app does all search/sort/date-filtering client-side. This
 * is also the app's token validation: a 200 means the token is good, a 401 means
 * show the gate.
 */
export async function GET(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get("token");
  const { readToken } = await getTokens();
  if (!readToken || token !== readToken) {
    return json({ error: "unauthorized" }, 401);
  }

  // Lazily ensure the schema so a fresh self-hosted database returns an empty
  // history instead of erroring on a missing table.
  await ensureSchema();

  const rows = await sql`
    SELECT id, original_url, title, captured_at
    FROM saved_items
    ORDER BY captured_at DESC, id DESC
  `;
  const items: Item[] = rows.map((r) => ({
    id: r.id as string,
    url: r.original_url as string,
    title: r.title as string,
    capturedAt: new Date(r.captured_at as string).toISOString(),
  }));
  return json(items, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
