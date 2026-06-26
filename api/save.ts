// NOTE: explicit .js extensions are required — Vercel compiles each function to
// ESM ("type":"module"), and Node ESM does not resolve extensionless relative
// imports at runtime. TS (bundler resolution) and Bun still map these to the .ts.
import { sql } from "../lib/db.js";
import { ensureSchema } from "../lib/schema.js";
import { getTokens } from "../lib/config.js";
import { normalizeUrl } from "../lib/normalize.js";
import { CORS_HEADERS, preflight } from "../lib/cors.js";
import type { SaveRequest, SaveResponse } from "../lib/contract.js";

/** CORS preflight — the extension's authorized POST is not a "simple" request. */
export async function OPTIONS(): Promise<Response> {
  return preflight();
}

/**
 * Save endpoint: authenticate, validate, normalize, upsert.
 *
 * Dedupe is a UNIQUE constraint on normalized_url + ON CONFLICT DO NOTHING; a
 * re-save of a normalized-equivalent URL returns `duplicate` (a normal outcome),
 * never a second row. Only http(s) URLs are accepted; an empty title falls back
 * to the normalized host so the feed is never blank.
 */
export async function POST(req: Request): Promise<Response> {
  // Auth is checked before any DB access so an unauthorized caller never
  // reaches the datastore.
  const { writeToken } = await getTokens();
  const auth = req.headers.get("authorization");
  if (!writeToken || auth !== `Bearer ${writeToken}`) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: SaveRequest;
  try {
    body = (await req.json()) as SaveRequest;
  } catch {
    return json({ error: "invalid-body" }, 400);
  }
  const { url, title } = body;

  // Server-side scheme guard: reject non-http(s) so junk never reaches the
  // datastore even if the client's is-capturable check was bypassed.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return json({ error: "invalid-url" }, 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return json({ error: "invalid-url" }, 400);
  }

  const normalized = normalizeUrl(url);
  // Title fallback: empty/whitespace title becomes the normalized host.
  const finalTitle = (title ?? "").trim() || new URL(normalized).hostname;

  // Lazily ensure the schema (incl. the unique index `ON CONFLICT` relies on)
  // so a brand-new self-hosted database needs no manual migration.
  await ensureSchema();

  const inserted = await sql`
    INSERT INTO saved_items (original_url, normalized_url, title)
    VALUES (${url}, ${normalized}, ${finalTitle})
    ON CONFLICT (normalized_url) DO NOTHING
    RETURNING id
  `;
  if (inserted.length > 0) {
    return json({ outcome: "saved", id: inserted[0].id as string } satisfies SaveResponse, 200);
  }

  // Conflict: the normalized URL already exists — return its id as a duplicate.
  const existing = await sql`
    SELECT id FROM saved_items WHERE normalized_url = ${normalized}
  `;
  return json({ outcome: "duplicate", id: existing[0].id as string } satisfies SaveResponse, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
