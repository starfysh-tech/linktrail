/**
 * Pure view-decision functions for the review app — the testable seam (mirrors
 * the extension's capture.ts). No DOM, no fetch: all search / sort / date-filter
 * / token / auth logic lives here so it can be unit-tested in isolation; app.ts
 * wires it to the runtime.
 */
import type { Item } from "../../lib/contract";

export type DatePreset = "all" | "today" | "week" | "month";
export type AuthState = "gate" | "ready";

/** Pull a `?token=` value from a URL, or null if absent/unparseable. */
export function parseToken(url: string): string | null {
  try {
    return new URL(url).searchParams.get("token");
  } catch {
    return null;
  }
}

/** Have a token → show the list; otherwise → show the gate. */
export function authState(token: string | null | undefined): AuthState {
  return token ? "ready" : "gate";
}

/**
 * The items URL for a search query, or null when the query is empty/whitespace
 * (the caller then renders the already-loaded full history without a round-trip).
 * Search runs server-side because it now spans the archived Markdown body, which
 * never ships to the client — so this just builds the request URL; the matching
 * is SQL. The read token rides in the query like the feed URL.
 */
export function itemsSearchUrl(query: string, token: string): string | null {
  const q = query.trim();
  if (!q) return null;
  return `/api/items?token=${encodeURIComponent(token)}&q=${encodeURIComponent(q)}`;
}

/** Newest-first by capturedAt; returns a new array (does not mutate input). */
export function sortItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt));
}

/**
 * Inclusive lower bound (epoch ms) for a date preset relative to `now`.
 * "today" is local-midnight; "week"/"month" are rolling 7-/30-day windows.
 * "all" returns 0 (no bound).
 */
export function presetSince(preset: DatePreset, now: number): number {
  const d = new Date(now);
  switch (preset) {
    case "all":
      return 0;
    case "today":
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    case "week":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "month":
      return now - 30 * 24 * 60 * 60 * 1000;
  }
}

/** Keep items captured at or after the preset's lower bound. */
export function filterByDate(items: Item[], preset: DatePreset, now: number): Item[] {
  const since = presetSince(preset, now);
  if (since === 0) return items;
  return items.filter((i) => Date.parse(i.capturedAt) >= since);
}

/**
 * The per-item Markdown download URL, or null when the item has no archived copy
 * — this gates the "Download .md" affordance. The endpoint streams the file with
 * a `Content-Disposition` filename, so a plain navigation downloads it; the read
 * token rides in the query like the feed URL.
 */
export function markdownDownloadUrl(item: Item, token: string): string | null {
  if (!item.hasMarkdown) return null;
  return `/api/items?id=${encodeURIComponent(item.id)}&format=md&token=${encodeURIComponent(token)}`;
}

/** Bare domain for display (drops scheme + leading www.); raw input on failure. */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * The portable export shape — written by both the in-app JSON export and the CLI
 * `scripts/export.ts`, and read back by `scripts/import.ts`. Intentionally drops
 * `id` and `normalized_url`: ids aren't referenced anywhere external, and the
 * normalized identity is recomputed on import via shared `lib/normalize`.
 */
export interface ExportFile {
  linktrail: number; // schema version
  exportedAt: string; // ISO-8601
  items: { url: string; title: string; capturedAt: string }[];
}

/** Serialize the history to the portable JSON export (re-importable, lossless). */
export function toJsonExport(items: Item[], exportedAt: string): string {
  const payload: ExportFile = {
    linktrail: 1,
    exportedAt,
    items: items.map((i) => ({ url: i.url, title: i.title, capturedAt: i.capturedAt })),
  };
  return JSON.stringify(payload, null, 2);
}

/** Minimal HTML-attribute/text escaping for the bookmark export. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Serialize the history to the Netscape bookmark HTML format — the de-facto
 * interop format that browsers, Pocket, Instapaper, etc. import. `ADD_DATE` is
 * unix seconds (omitted when the timestamp won't parse).
 */
export function toBookmarkHtml(items: Item[]): string {
  const rows = items.map((i) => {
    const secs = Math.floor(Date.parse(i.capturedAt) / 1000);
    const addDate = Number.isNaN(secs) ? "" : ` ADD_DATE="${secs}"`;
    return `    <DT><A HREF="${escapeHtml(i.url)}"${addDate}>${escapeHtml(i.title || i.url)}</A>`;
  });
  return [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Linktrail</H1>",
    "<DL><p>",
    ...rows,
    "</DL><p>",
    "",
  ].join("\n");
}

/**
 * Serialize the history to OPML 2.0 as `type="link"` outlines. Note: OPML is
 * conventionally a *feed-subscription* format, so some readers may try to
 * subscribe to each URL rather than treat it as a saved link — included by
 * request for RSS-ecosystem interop.
 */
export function toOpml(items: Item[]): string {
  const rows = items.map(
    (i) =>
      `    <outline text="${escapeHtml(i.title || i.url)}" type="link" url="${escapeHtml(i.url)}"/>`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head><title>Linktrail</title></head>",
    "  <body>",
    ...rows,
    "  </body>",
    "</opml>",
    "",
  ].join("\n");
}

/** Compact relative time ("just now", "5m ago", "3h ago", "2d ago"); date past a week. */
export function relativeTime(capturedAt: string, now: number): string {
  const diff = now - Date.parse(capturedAt);
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(capturedAt).toLocaleDateString();
}
