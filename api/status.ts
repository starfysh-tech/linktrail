// Explicit .js extensions required for Node ESM on Vercel (see api/save.ts).
import { sql } from "../lib/db.js";
import { normalizeUrl } from "../lib/normalize.js";
import { CORS_HEADERS, preflight } from "../lib/cors.js";
import type { StatusResponse } from "../lib/contract.js";

/** CORS preflight — the popup calls status cross-origin with an Authorization header. */
export async function OPTIONS(): Promise<Response> {
  return preflight();
}

/**
 * Status endpoint: has this URL already been saved?
 *
 * The popup calls this on open so it can show a subtle "already saved" hint
 * without the user clicking Save. Auth uses the write token (the only token the
 * popup holds outside the feed URL); checking one's own save status is an
 * owner-level read. URL identity uses the SHARED normalization, so the hint
 * matches exactly what a save would dedupe against.
 */
export async function GET(req: Request): Promise<Response> {
  // Auth before any DB access so an unauthorized caller never reaches the datastore.
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.WRITE_TOKEN}`) {
    return json({ saved: false }, 401);
  }

  const url = new URL(req.url).searchParams.get("url");
  if (!url) {
    return json({ saved: false }, 400);
  }

  // Reject non-http(s)/malformed before normalizing so junk never hits the DB.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return json({ saved: false }, 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return json({ saved: false }, 400);
  }

  const normalized = normalizeUrl(url);
  const rows = await sql`
    SELECT id FROM saved_items WHERE normalized_url = ${normalized}
  `;
  if (rows.length > 0) {
    return json({ saved: true, id: rows[0].id as string }, 200);
  }
  return json({ saved: false }, 200);
}

function json(body: StatusResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
