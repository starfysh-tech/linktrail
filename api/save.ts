// NOTE: explicit .js extensions are required — Vercel compiles each function to
// ESM ("type":"module"), and Node ESM does not resolve extensionless relative
// imports at runtime. TS (bundler resolution) and Bun still map these to the .ts.
import { sql } from "../lib/db.js";
import { normalizeUrl } from "../lib/normalize.js";
import type { SaveRequest, SaveResponse } from "../lib/contract.js";

/**
 * Save endpoint — the thinnest possible insert for Slice 1.
 *
 * Dedupe/upsert, scheme validation, title fallback, and CORS are all Slice 2 by
 * design; this slice only authenticates, normalizes, and inserts one row.
 */
export async function POST(req: Request): Promise<Response> {
  // Auth is checked before any DB access so an unauthorized caller never
  // reaches the datastore.
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.WRITE_TOKEN}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const { url, title } = (await req.json()) as SaveRequest;
  const normalized = normalizeUrl(url);

  const rows = await sql`
    INSERT INTO saved_items (original_url, normalized_url, title)
    VALUES (${url}, ${normalized}, ${title})
    RETURNING id
  `;
  const id = rows[0].id as string;

  const body: SaveResponse = { outcome: "saved", id };
  return json(body, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
