/**
 * Pure article-extraction decisions — a testable seam (PRD Seam 3).
 *
 * Turns a page's serialized HTML into clean Markdown (Mozilla Readability for
 * main-content isolation, Turndown for HTML→Markdown), plus the small pure
 * helpers around it: filename derivation and YAML front-matter assembly.
 *
 * Deliberately free of `chrome.*`, `fetch`, the DOM globals (`document`,
 * `DOMParser`, `window`) and the DB. The one piece of DOM that Readability
 * genuinely needs — a parsed `Document` — is DEPENDENCY-INJECTED as `toDocument`
 * so the impure glue owns the parsing: the popup passes a `DOMParser`-backed
 * parser, the unit tests pass a `linkedom`-backed one. Turndown brings its own
 * headless parser, so it takes the article HTML string directly.
 */
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

/** Outcome of an extraction attempt. `ok: false` means "no main content" — the
 *  caller should surface that rather than emit the empty/garbage markdown. */
export interface ExtractResult {
  markdown: string;
  title: string;
  ok: boolean;
}

/** Parse serialized HTML into a Readability-ready `Document`. Supplied by the
 *  caller (real `DOMParser` in the popup, `linkedom` in tests) so this module
 *  never touches a DOM global. */
export type HtmlToDocument = (html: string) => Document;

/** Turndown configured to match the reference extractor's Markdown style:
 *  ATX headings, fenced code, `-` bullets, `_` emphasis, `---` rules. */
function newTurndown(): TurndownService {
  return new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "_",
  });
}

/**
 * Extract the main article from `html` and convert it to Markdown.
 *
 * Returns `ok: false` (with empty markdown) when Readability finds no usable
 * main content — e.g. an un-hydrated SPA shell — so the glue can tell the user
 * "no article found" instead of downloading boilerplate. `title` prefers
 * Readability's parsed title, then the caller's tab title, then a URL fallback.
 */
export function extractMarkdown(
  html: string,
  url: string,
  title: string,
  toDocument: HtmlToDocument,
): ExtractResult {
  const fallbackTitle = title.trim() || deriveTitleFromUrl(url);

  let article: ReturnType<Readability["parse"]> = null;
  try {
    const doc = toDocument(html);
    article = new Readability(doc).parse();
  } catch {
    article = null;
  }

  if (!article || !article.content || (article.textContent ?? "").trim().length === 0) {
    return { markdown: "", title: fallbackTitle, ok: false };
  }

  const content = article.content;
  let markdown = "";
  try {
    markdown = newTurndown().turndown(content).trim();
  } catch {
    markdown = "";
  }
  if (!markdown) {
    return { markdown: "", title: fallbackTitle, ok: false };
  }

  return { markdown, title: article.title?.trim() || fallbackTitle, ok: true };
}

/**
 * A safe `.md` filename derived from the article title, falling back to the
 * URL's host+path, then a constant. Slugged to lowercase ASCII words so it's
 * portable across filesystems.
 */
export function markdownFilename(title: string, url: string): string {
  let slug = slugify(title);
  if (!slug) {
    try {
      const u = new URL(url);
      slug = slugify(`${u.hostname}${u.pathname}`);
    } catch {
      // Unparseable URL — fall through to the constant below.
    }
  }
  return `${slug || "page"}.md`;
}

/**
 * A YAML front-matter block carrying the capture metadata. `capturedAt` is an
 * already-formatted timestamp (e.g. an ISO string) passed in by the caller —
 * this stays pure and deterministic, so the glue owns the clock.
 */
export function frontMatter(meta: { title: string; url: string; capturedAt: string }): string {
  const esc = (s: string): string => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return [
    "---",
    `title: "${esc(meta.title)}"`,
    `url: ${meta.url}`,
    `captured: ${meta.capturedAt}`,
    "---",
  ].join("\n");
}

/** Compose the downloadable file: front-matter, then the article markdown. */
export function markdownDocument(meta: { title: string; url: string; capturedAt: string }, markdown: string): string {
  return `${frontMatter(meta)}\n\n${markdown}\n`;
}

/**
 * Generous ceiling, in base64 characters, for an archived gzip'd markdown body
 * riding along on the save request. A page past this is saved url+title only.
 * Deliberately a single flat constant — not a tuned byte budget — since the
 * compressed-then-base64 size of even long articles sits far below it.
 */
export const GZ_BASE64_CAP = 4_000_000;

/**
 * Pure cap decision: is a base64 gzip payload of this length small enough to
 * carry on the wire? Isolated from the async gzip glue so it stays unit-testable.
 * Empty (length 0) is rejected — there's nothing worth sending.
 */
export function withinGzCap(base64Length: number): boolean {
  return base64Length > 0 && base64Length <= GZ_BASE64_CAP;
}

/**
 * Archive a page as `SaveRequest.markdownGz`: extract the article, build the full
 * Markdown document, gzip it, and base64-encode the bytes.
 *
 * Returns `undefined` — and NEVER throws — whenever archiving can't or shouldn't
 * happen: no extractable article (`ok: false`), a gzip/encoding failure, or a
 * compressed body past {@link GZ_BASE64_CAP}. Archiving is always best-effort:
 * the caller then saves url+title only, so this must never block or fail a save.
 *
 * `toDocument` is dependency-injected (popup → `DOMParser`, service worker →
 * `linkedom`, tests → `linkedom`) to keep this module free of DOM globals; the
 * gzip step uses the `CompressionStream` Web API, available in both the popup and
 * the MV3 service worker.
 */
export async function packMarkdownGz(
  html: string,
  url: string,
  title: string,
  toDocument: HtmlToDocument,
  capturedAt: string,
): Promise<string | undefined> {
  try {
    const { markdown, title: docTitle, ok } = extractMarkdown(html, url, title, toDocument);
    if (!ok) return undefined;
    const doc = markdownDocument({ title: docTitle, url, capturedAt }, markdown);
    const gz = await gzipToBase64(doc);
    return withinGzCap(gz.length) ? gz : undefined;
  } catch {
    // Injection/readability/compression failure — degrade to a url+title save.
    return undefined;
  }
}

/** Gzip `text` via the streaming Web API and base64-encode the resulting bytes. */
async function gzipToBase64(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return bytesToBase64(bytes);
}

/** Base64 a byte array in chunks so a large body never overflows the call stack
 *  via `String.fromCharCode(...spread)`. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Lowercase ASCII slug; non-alphanumeric runs collapse to single hyphens. */
function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

/** Last-resort title when neither Readability nor the tab gives one. */
function deriveTitleFromUrl(url: string): string {
  try {
    return new URL(url).hostname || "Untitled";
  } catch {
    return "Untitled";
  }
}
