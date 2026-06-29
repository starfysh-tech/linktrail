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
  const params = new URL(req.url).searchParams;
  const token = params.get("token");
  const { readToken } = await getTokens();
  if (!readToken || token !== readToken) {
    return json({ error: "unauthorized" }, 401);
  }

  // Lazily ensure the schema so a fresh self-hosted database returns an empty
  // history instead of erroring on a missing table.
  await ensureSchema();

  // Single-item Markdown download: `?id=…&format=md` returns the archived body
  // as an attachment. Same read-token auth as the list; 404 when the row is
  // missing or has no archived markdown.
  const id = params.get("id");
  if (id && params.get("format") === "md") {
    const rows = await sql`
      SELECT markdown, title, original_url FROM saved_items WHERE id = ${id}
    `;
    const markdown = rows[0]?.markdown as string | null | undefined;
    if (!rows.length || markdown == null) {
      return json({ error: "not-found" }, 404);
    }
    const filename = markdownFilename(
      (rows[0].title as string) || "",
      rows[0].original_url as string,
    );
    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        ...CORS_HEADERS,
      },
    });
  }

  const rows = await sql`
    SELECT id, original_url, title, captured_at, markdown IS NOT NULL AS has_markdown
    FROM saved_items
    ORDER BY captured_at DESC, id DESC
  `;
  const items: Item[] = rows.map((r) => ({
    id: r.id as string,
    url: r.original_url as string,
    title: r.title as string,
    capturedAt: new Date(r.captured_at as string).toISOString(),
    hasMarkdown: r.has_markdown as boolean,
  }));
  return json(items, 200);
}

/**
 * Derive a safe `.md` download filename from the page title (falling back to the
 * URL host). Kept inline — the extension owns its own filename helper; sharing
 * across the deploy boundary would couple unrelated bundles. Strips characters
 * unsafe for a Content-Disposition value / common filesystems.
 */
function markdownFilename(title: string, originalUrl: string): string {
  let base = title.trim();
  if (!base) {
    try {
      base = new URL(originalUrl).hostname;
    } catch {
      base = "page";
    }
  }
  const safe = base
    .replace(/[\\/:*?"<>|]/g, "-") // filesystem- and header-unsafe chars
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100)
    .replace(/[. ]+$/, ""); // trailing dots/spaces are invalid on Windows
  return `${safe || "page"}.md`;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
