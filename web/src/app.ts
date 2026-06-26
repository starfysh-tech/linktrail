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
  filterItems,
  filterByDate,
  sortItems,
  domainOf,
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

/** Apply the current search + date preset and paint the list. */
function render(): void {
  const query = $<HTMLInputElement>("search").value;
  const now = Date.now();
  const items = filterByDate(filterItems(allItems, query), preset, now);

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
  return li;
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

  $("search").addEventListener("input", render);

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
