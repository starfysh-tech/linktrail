# Slice 6 — Review UI (search & browse your full history)

## What to build

A private, read-only web app for finding and revisiting anything you've ever
saved — the job the RSS feed can't do (the feed shows only the latest 50 and
isn't searchable). It lives on the **same Vercel origin** as the backend, behind
a **read-token gate**, and reuses the graphite/amber glass language.

### Surface & hosting
- A static app (vanilla HTML/CSS/TS, Vite-built) in a new top-level `web/` dir
  (sibling to `extension/`, honoring the flat-repo rule), served at **`/app`** on
  the Vercel project. `vercel.json` gains `buildCommand`/`outputDirectory`; the
  `api/*` functions stay zero-config. Same origin as `/api/*` ⇒ no CORS.

### Data
- One new endpoint **`GET /api/items?token=<read>`** returns the user's whole
  history as JSON (`id, url, title, capturedAt`), newest-first. Read-token auth
  via the `?token=` query, mirroring `api/feed.ts`. 401 on missing/wrong token.
- The app fetches once and does **all** search / sort / date-filtering **in the
  browser** (client-side). Fine to low thousands of items; document the cap.

### Auth (read token, with an unauthenticated state)
- The popup gains a **History chip** that deep-links `…/app?token=<read>` (the
  read token is derived from the stored `feedUrl`; if there's no `feedUrl` yet,
  the chip opens options, like the Feed chip).
- On load the app takes the token from the URL, validates it (a 200 from
  `/api/items`), persists it to `localStorage`, then `history.replaceState`s a
  clean URL. Reloads read the token from `localStorage`.
- No token, or a token the endpoint rejects (401) → the **gate**: a prompt to
  paste a read token. The app only ever holds the **read** token (least
  privilege; safe in a browser tab).

### View
- A list of items (favicon/domain, title, cleaned URL, relative time), newest
  first, each opening the original URL in a new tab.
- A search box (matches title or URL, client-side) and quick **date presets**
  (All / Today / This week / This month), computed in memory.

## Acceptance criteria

- [ ] `GET /api/items` returns 401 with a missing or wrong read token, and on a
      valid read token returns the full history as JSON, newest-first.
- [ ] The app, opened with a valid `?token=`, validates it, stores it in
      `localStorage`, and removes the token from the visible URL.
- [ ] Reloading the app (no `?token=` in the URL) stays authenticated from
      `localStorage`.
- [ ] With no stored token and none in the URL, the app shows the gate, not the
      list; pasting a valid read token unlocks it; an invalid one is rejected.
- [ ] The list shows every saved item (not just the latest 50), newest-first,
      and each item opens its original URL.
- [ ] Typing in the search box filters the list by title or URL, client-side,
      with no extra network calls.
- [ ] The date presets (All / Today / This week / This month) filter the list
      correctly against `capturedAt`.
- [ ] The popup History chip opens the app already authenticated; with no
      configured feed it falls back to opening options.
- [ ] No write capability exists in the app (read-only); the app never holds the
      write token.

## Testing seams

- **Seam 1 (backend HTTP, integration):** `GET /api/items` — auth (401 no/wrong
  read token) without DB; DB-gated round-trip asserting items return newest-first
  with the expected shape. Mirrors `tests/api.test.ts`.
- **New pure seam (`web/src/view.ts`), unit:** `filterItems(items, query)`,
  `sortItems`, date-preset predicate, `parseToken(url)`, and
  `authState(token) → "gate" | "ready"`. No DOM, no `fetch` — tested like
  `extension/src/capture.ts`. The token→localStorage glue and `fetch` wiring are
  impure and manual-verify (like `popup.ts`/`sw.ts`).

## Out of scope (v1)

- Delete / edit / re-capture (a write op — would force the write token into the
  browser, breaking the read-only/least-privilege model).
- Tags / notes (require schema changes).
- Server-side search / pagination (client-side is sufficient at personal scale).
- A public landing/marketing page at the Vercel root (that lives on GitHub Pages).

## Blocked by

- Slice 2 — Normalization, dedupe & backend hardening (the `saved_items` table &
  read-token convention).
- Slice 3 — Setup & options (the stored `feedUrl`/read token the History chip
  deep-links from).
