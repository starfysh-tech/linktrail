// Explicit .js extension required for Node ESM on Vercel (see api/save.ts).
import { sql } from "../lib/db.js";
import { CORS_HEADERS, preflight } from "../lib/cors.js";

/** CORS preflight (parity with save; harmless for direct RSS-reader fetches). */
export async function OPTIONS(): Promise<Response> {
  return preflight();
}

/**
 * RSS feed endpoint. The read token rides in the feed URL's query string (a
 * distinct, unguessable token from the bearer write token) so the feed can be
 * subscribed to by URL alone in any RSS reader.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Auth before DB access: an unauthorized caller never reaches the datastore.
  const token = url.searchParams.get("token");
  if (token !== process.env.READ_TOKEN) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const rows = await sql`
    SELECT id, original_url, normalized_url, title, captured_at
    FROM saved_items
    ORDER BY captured_at DESC
    LIMIT 50
  `;

  const items = rows
    .map(
      (r) => `    <item>
      <title>${escapeXml(r.title)}</title>
      <link>${escapeXml(r.original_url)}</link>
      <guid isPermaLink="false">${escapeXml(r.normalized_url)}</guid>
      <pubDate>${new Date(r.captured_at).toUTCString()}</pubDate>
      <description>${escapeXml(r.title)}</description>
    </item>`,
    )
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Linktrail</title>
    <link>${escapeXml(url.origin)}</link>
    <description>Your personal reading history.</description>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    status: 200,
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", ...CORS_HEADERS },
  });
}

/** Escape the five XML predefined entities in any dynamic text. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
