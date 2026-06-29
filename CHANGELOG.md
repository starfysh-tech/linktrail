# Changelog

All notable changes to Linktrail. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Versions track the **extension**
(`extension/manifest.config.ts` + `package.json`); backend-only and web-app-only
changes ship continuously and are grouped under **Unreleased (backend / web)**.

## Unreleased (backend / web — no extension version bump)

These ship via Vercel and need a redeploy to take effect on a self-hosted backend.

### Added
- **Content search** — `GET /api/items?q=` does a literal, case-insensitive
  substring match across title, URL, **and the archived Markdown body**. Matching
  is server-side (the body never ships to the list); the review app's search box
  is debounced and routes through it.
- **Rendered Markdown preview** — an eye "Preview" button on each archived item
  opens a glass modal that renders the `.md` (marked → DOMPurify sanitize),
  including **Mermaid diagrams** (lazy-loaded only when a diagram is present).
- **Download `.md`** — a cloud-download button serves one item's archived Markdown
  via `GET /api/items?id=…&format=md` (`text/markdown` attachment).
- **Delete** — a trash button (click-to-confirm) removes an item via
  `DELETE /api/items?id=`, authorized by the **write token** (not the read token)
  and UUID-validated.

### Changed
- **Refresh-on-save** — re-saving an existing URL now **overwrites** its archived
  Markdown when the save carries one (previously first-archive-wins). A save
  without Markdown never wipes an existing archive.

## [0.16.0] — 2026-06-29
### Changed
- Much cleaner Markdown extraction for app-style pages. A new in-page reader
  (`page-reader.ts`) runs a whitespace **separator pass** (via `getComputedStyle`)
  so adjacent values stop fusing (e.g. "Chest armorWyward's Aspect" →
  "Chest armor Wyward's Aspect"). `extract.ts` `cleanDocument()` strips noise
  (scripts/media, controls, nav/footer/aside, `aria-hidden`, decorative empty-alt
  images) before Readability, and Turndown gains the GFM plugin so real tables
  survive. Validated against a live build-guide page (icon spam 22 → 0).

## [0.15.0] — 2026-06-28
### Added
- Archive a **Markdown copy of the page on save**: the extension extracts the page
  to Markdown, gzips it, and sends it with the save (`SaveRequest.markdownGz`); the
  backend stores it (`saved_items.markdown`, idempotent `ALTER TABLE`). Saving now
  reads and stores page **content**, not just URL + title. The offline queue carries
  the Markdown so retries don't re-extract; oversized/failed extractions degrade to
  a url+title save.

## [0.14.0] — 2026-06-28
### Added
- Local **"Export page as Markdown"** from the popup — Mozilla Readability +
  Turndown → clipboard + `.md` download. Pure `extract.ts` seam with unit tests.
- `scripting` permission (the popup gesture grants `activeTab`; no broad
  `host_permissions`).

## [0.13.0] — 2026-06-25
### Added
- Options page links to the self-hosting guide (Deploy-to-Vercel setup). No
  permission change.

## [0.12.0] — 2026-06-25
### Added
- Popup **History** chip opening a private, read-only review web app
  (search/browse full history) at `/app`, backed by new `GET /api/items`.

## [0.11.0] — 2026-06-25
### Added
- Optional host access requested at **runtime** for the user's backend origin, so
  CORS-less self-hosted backends work (additive; CORS fallback retained).

## [0.10.0] — 2026-06-25
### Added
- Offline retry queue: temporary failures are parked in `chrome.storage.local` and
  auto-retried (new `alarms` permission).

## [0.9.0] — 2026-06-25
### Added
- Popup "already saved on open" hint + `GET /api/status` endpoint.

## [0.8.1] — 2026-06-25
### Added
- `homepage_url` (landing page); landing page + privacy policy published via
  GitHub Pages.

## [0.8.0] — 2026-06-25
### Added
- Initial release: toolbar save, keyboard-shortcut save, private RSS reading
  history, first-run backend + write-token setup.
