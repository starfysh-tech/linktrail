/**
 * Review app controller — the impure glue (DOM + fetch + localStorage) over the
 * pure decisions in ./view. Read-only: it only ever holds the read token.
 *
 * Token flow: take ?token= from the URL (the popup deep-links it), validate it
 * via a 200 from /api/items, persist to localStorage, then strip it from the
 * visible URL. Reloads read from localStorage. No/invalid token → the gate.
 */
import {
  parseToken,
  authState,
  itemsSearchUrl,
  filterByDate,
  sortItems,
  domainOf,
  markdownDownloadUrl,
  relativeTime,
  toJsonExport,
  toBookmarkHtml,
  toOpml,
  type DatePreset,
} from "./view";
import type { Item } from "../../lib/contract";

const TOKEN_KEY = "linktrail_read_token";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

let allItems: Item[] = [];
// Server search results for the active query, or null when the search box is
// empty (render then falls back to the full in-memory history, no round-trip).
let searchResults: Item[] | null = null;
let searchSeq = 0; // guards against out-of-order search responses
let token: string | null = null;
let preset: DatePreset = "all";

/** Resolve the token: URL first (then persisted + URL cleaned), else storage. */
function resolveToken(): string | null {
  const fromUrl = parseToken(location.href);
  if (fromUrl) {
    localStorage.setItem(TOKEN_KEY, fromUrl);
    history.replaceState(null, "", location.pathname);
    return fromUrl;
  }
  return localStorage.getItem(TOKEN_KEY);
}

function showGate(error?: string): void {
  $("gate").hidden = false;
  $("app").hidden = true;
  const err = $("gate-error");
  err.hidden = !error;
  err.textContent = error ?? "";
}

function setStatus(message: string | null): void {
  const el = $("status");
  el.hidden = !message;
  el.textContent = message ?? "";
}

/** Fetch the full history; 401 → gate, network error → retryable status. */
async function load(): Promise<void> {
  if (!token) return showGate();
  setStatus("Loading your history…");
  try {
    const res = await fetch(`/api/items?token=${encodeURIComponent(token)}`);
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      token = null;
      setStatus(null);
      return showGate("That token didn’t work. Check it and try again.");
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allItems = sortItems((await res.json()) as Item[]);
    setStatus(null);
    $("gate").hidden = true;
    $("app").hidden = false;
    render();
  } catch {
    setStatus("Couldn’t reach the backend. Refresh to retry.");
  }
}

/**
 * Run a search. Empty query → clear results and render the full history with no
 * round-trip. Otherwise fetch server-side matches (title + URL + Markdown body);
 * a sequence guard drops stale responses so fast typing can't paint old results.
 */
async function runSearch(query: string): Promise<void> {
  const url = token ? itemsSearchUrl(query, token) : null;
  if (!url) {
    searchResults = null;
    render();
    return;
  }
  const seq = ++searchSeq;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = sortItems((await res.json()) as Item[]);
    if (seq !== searchSeq) return; // superseded by a newer query
    searchResults = items;
    render();
  } catch {
    if (seq !== searchSeq) return;
    setStatus("Search failed — refresh to retry.");
  }
}

/**
 * Paint the list from the active result set (server search results when a query
 * is active, else the full history) with the date preset applied client-side.
 */
function render(): void {
  const now = Date.now();
  const base = searchResults ?? allItems;
  const items = filterByDate(base, preset, now);

  const list = $<HTMLUListElement>("list");
  list.replaceChildren(...items.map((item) => row(item, now)));
  $("count").textContent = `${items.length} of ${allItems.length}`;
  $("empty").hidden = items.length > 0;
}

/** Build one safe list row (textContent only — saved titles are untrusted). */
function row(item: Item, now: number): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "item";

  const a = document.createElement("a");
  a.className = "item-link";
  a.href = item.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";

  const domain = domainOf(item.url);
  const tile = document.createElement("span");
  tile.className = "tile";
  tile.textContent = (domain[0] ?? "?").toUpperCase();

  const meta = document.createElement("div");
  meta.className = "meta";
  const title = document.createElement("p");
  title.className = "title";
  title.textContent = item.title || domain;
  const sub = document.createElement("p");
  sub.className = "sub";
  sub.textContent = `${domain} · ${relativeTime(item.capturedAt, now)}`;
  meta.append(title, sub);

  a.append(tile, meta);
  li.append(a);

  // Archived-Markdown affordances (only when an archive exists): a Preview button
  // that opens the rendered modal, and a Download link to the per-item .md
  // endpoint (the server's Content-Disposition drives the file save). Both are
  // siblings of the row's <a>, not nested inside it.
  const mdUrl = token ? markdownDownloadUrl(item, token) : null;
  if (mdUrl) {
    const actions = document.createElement("div");
    actions.className = "row-actions";

    const view = document.createElement("button");
    view.type = "button";
    view.className = "icon-btn";
    view.title = "Preview";
    view.setAttribute("aria-label", `Preview ${item.title || domain}`);
    view.innerHTML = ICON_EYE; // static, trusted SVG constant
    view.addEventListener("click", () => void openPreview(item, mdUrl));

    const dl = document.createElement("a");
    dl.className = "icon-btn";
    dl.href = mdUrl;
    dl.title = "Download .md";
    dl.setAttribute("aria-label", `Download Markdown for ${item.title || domain}`);
    dl.innerHTML = ICON_DOWNLOAD;

    actions.append(view, dl);
    li.append(actions);
  }
  return li;
}

// Untitled UI icons (eye, download-cloud-02): static, trusted constants.
const ICON_EYE =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.4201 12.7132c-.1362-.2157-.2043-.3235-.2424-.4898-.0286-.1249-.0286-.3219 0-.4468.0381-.1663.1062-.2741.2424-.4898C3.5455 9.5048 6.8954 5 12.0004 5s8.4549 4.5048 9.5803 6.2868c.1362.2157.2043.3235.2424.4898.0286.1249.0286.3219 0 .4468-.0381.1663-.1062.2741-.2424.4898C20.4553 14.4952 17.1054 19 12.0004 19s-8.4549-4.5048-9.5803-6.2868"/><path d="M12.0004 15c1.6569 0 3-1.3431 3-3s-1.3431-3-3-3-3 1.3431-3 3 1.3431 3 3 3"/></svg>';
const ICON_DOWNLOAD =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 17 4 4m0 0 4-4m-4 4v-9m8 4.7428c1.2215-1.0088 2-2.5349 2-4.2428C22 9.4624 19.5376 7 16.5 7c-.2185 0-.4229-.114-.5339-.3023C14.6621 4.4848 12.2544 3 9.5 3 5.3579 3 2 6.3579 2 10.5c0 2.0661.8354 3.9371 2.187 5.2935"/></svg>';

/**
 * Open the rendered-Markdown preview modal for an item. Fetches the archived .md
 * (same endpoint as download), then lazy-imports the renderer (marked + sanitize
 * + Mermaid) so none of it loads until a preview is actually opened.
 */
async function openPreview(item: Item, mdUrl: string): Promise<void> {
  const dlg = $<HTMLDialogElement>("preview");
  $("preview-title").textContent = item.title || domainOf(item.url);
  const body = $("preview-body");
  body.textContent = "Loading…";
  if (!dlg.open) dlg.showModal();
  try {
    const res = await fetch(mdUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();
    const { renderMarkdownInto } = await import("./preview");
    await renderMarkdownInto(body, md);
  } catch {
    body.textContent = "Couldn’t load this preview.";
  }
}

/** Trigger a client-side file download of in-memory content (no server round-trip). */
function download(filename: string, mime: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function init(): void {
  token = resolveToken();

  $("unlock").addEventListener("click", () => {
    const value = $<HTMLInputElement>("token-input").value.trim();
    if (!value) return;
    localStorage.setItem(TOKEN_KEY, value);
    token = value;
    void load();
  });

  // Debounce so each keystroke doesn't fire a request; search runs server-side
  // because it spans the archived Markdown body (not loaded client-side).
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  $("search").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => void runSearch($<HTMLInputElement>("search").value), 250);
  });

  // Preview modal: Esc-to-close is native to <dialog>; add the close button and
  // backdrop-click, and free the rendered body on close.
  const previewDlg = $<HTMLDialogElement>("preview");
  $("preview-close").addEventListener("click", () => previewDlg.close());
  previewDlg.addEventListener("click", (e) => {
    if (e.target === previewDlg) previewDlg.close(); // click outside the panel
  });
  previewDlg.addEventListener("close", () => $("preview-body").replaceChildren());

  // Exports always cover the FULL history (allItems), not the filtered view.
  const stamp = new Date().toISOString().slice(0, 10);
  $("export-json").addEventListener("click", () =>
    download(`linktrail-${stamp}.json`, "application/json", toJsonExport(allItems, new Date().toISOString())),
  );
  $("export-html").addEventListener("click", () =>
    download(`linktrail-${stamp}.html`, "text/html", toBookmarkHtml(allItems)),
  );
  $("export-opml").addEventListener("click", () =>
    download(`linktrail-${stamp}.opml`, "text/x-opml", toOpml(allItems)),
  );

  for (const btn of document.querySelectorAll<HTMLButtonElement>(".preset")) {
    btn.addEventListener("click", () => {
      preset = btn.dataset.preset as DatePreset;
      for (const b of document.querySelectorAll<HTMLButtonElement>(".preset")) {
        b.setAttribute("aria-pressed", String(b === btn));
      }
      render();
    });
  }

  if (authState(token) === "gate") {
    showGate();
  } else {
    void load();
  }
}

if (typeof document !== "undefined") {
  init();
}
