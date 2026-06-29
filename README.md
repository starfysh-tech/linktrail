# Linktrail

Linktrail is a Chrome (Manifest V3) extension that captures the current browser
tab into a personal, RSS-backed reading history. A keyboard shortcut saves the
page silently; the toolbar button opens a glass popup for a deliberate save.
Captures land in a Neon Postgres datastore behind a small set of Vercel
Functions, and flow back out as an RSS feed you subscribe to in any reader. The
extension is intentionally thin — vanilla HTML/CSS + TypeScript, no UI framework —
with an Apple-native graphite-and-warm-amber "glass" look.

**Links:** [Landing page](https://starfysh-tech.github.io/linktrail/) ·
[History app](https://linktrail-alpha.vercel.app/app/) (read-token gated) ·
[Self-hosting guide](docs/self-hosting.md) ·
[Privacy policy](https://starfysh-tech.github.io/linktrail/privacy.html) ·
[Web Store listing prep](CHROMEWEBSTORE.md)

## How it works

The capture flow:

- **Shortcut** (`⌘⇧L` / `Ctrl+Shift+L`) → silent save, with a `✓` badge on the
  toolbar icon (a quiet `—` on non-capturable pages like `chrome://`).
- **Toolbar button** → a graphite glass popup for a deliberate, visible save.

On save, the extension also extracts a **cleaned Markdown copy of the page**
(Mozilla Readability + Turndown, run in the page so app-style markup converts
cleanly), gzips it, and sends it along. Both paths POST to **`/api/save`**, which:

1. Authenticates the request against the bearer **write token**.
2. **Normalizes** the URL to a canonical identity.
3. **Upserts** into Neon — same identity = same row, so re-saving dedupes
   instead of creating phantom duplicates. A re-save **refreshes** the stored
   Markdown; a save that carries no Markdown never wipes an existing archive.

Saved items are served back as RSS 2.0 (newest-first) from **`/api/feed`**,
guarded by an unguessable **read token** carried in the feed URL. The same
history is browsable in a private review web app (opened from the popup's
**History** button): **search by page content** (not just title/URL), **preview**
the archived Markdown rendered in a modal (including Mermaid diagrams),
**download** the `.md`, or **delete** an item.

> **Shared normalization (critical):** `lib/normalize.ts` is imported by **both**
> the extension and the backend. Both sides must compute the *identical* canonical
> URL — if they diverge they compute different identities and create phantom
> duplicate captures. Never fork or reimplement normalization per side.

## Layout

A flat single repo — backend functions, a shared `lib/`, the extension, and the
review web app are sibling top-level concerns (not a workspaces monorepo).

```
api/         Vercel Functions (deployed)
  save.ts    POST — auth, normalize, dedupe upsert
  feed.ts    GET  — RSS 2.0 feed, read-token guarded
  verify.ts  GET  — health/connectivity check
  status.ts  GET  — is this URL already saved? (popup "already saved" hint)
  items.ts   GET  — history JSON (read token); ?q= content search;
             ?id=&format=md downloads one item's archived Markdown.
             DELETE — remove one item (write-token guarded)
  setup.ts   GET/POST — first-run token reveal (zero-input self-host deploy)
lib/         Shared code (imported by api/, extension/, web/)
  normalize.ts  canonical URL identity — shared by ALL sides
  contract.ts   request/response shapes (SaveRequest carries optional markdownGz)
  cors.ts       CORS handling
  db.ts         Neon HTTP-driver access
  schema.ts     lazy, idempotent ensureSchema (auto-migrate on first use)
  config.ts     token resolution (env var > DB-claimed) + first-run claim
  load-env.ts   loads .env.local + .secrets.local for scripts/tests
extension/   MV3 extension (Vite + @crxjs/vite-plugin)
  manifest.config.ts            manifest (pinned key → stable extension ID)
  popup.html / options.html     entry pages
  src/{sw,popup,options,capture,queue}.ts + css, icons/
  src/extract.ts                pure: Readability+Turndown → Markdown, cleanup, gz
  src/page-reader.ts            in-page DOM read + whitespace separator pass
  src/turndown-plugin-gfm.d.ts  local type shim for the GFM plugin
web/         Review app — vanilla Vite, served at /app/ (same origin, deployed)
  index.html, src/{app,view,preview}.ts + app.css
                view.ts: search/sort/filter, export + delete URLs, mermaid detect
                preview.ts: lazy marked → DOMPurify → render (+ Mermaid)
scripts/
  migrate.ts        create the saved_items table (+ dev backfill/dedupe)
  reset-items.ts    clear saved items
  export.ts         back up full history to JSON
  import.ts         restore/merge a JSON backup (idempotent)
tests/       The test seams (see Test)
docs/
  prd-v1.md         authoritative PRD
  dev-setup.md       full setup + manual verify flow
  self-hosting.md    one-click self-host guide
  issues/01–08       the implementation slices
```

## Setup

Prerequisites: **Bun**, **Node**, the **Vercel CLI**, and a **Neon database**
provisioned via the Vercel Marketplace.

```sh
bun install
vercel link
# Neon's DATABASE_URL only lives in Production/Preview, NOT development — a plain
# `vercel env pull` would drop it, so pull the production environment explicitly.
vercel env pull .env.local --environment=production
```

Vercel exports **Sensitive** variables as empty values, so the real secrets do
not arrive via `env pull`. Put the actual `DATABASE_URL`, `WRITE_TOKEN`, and
`READ_TOKEN` into a gitignored **`.secrets.local`** — `lib/load-env.ts` loads it
on top of `.env.local` for scripts and tests. Then create the table:

```sh
bun run migrate
```

See [`docs/dev-setup.md`](docs/dev-setup.md) for the full setup and manual
verification flow.

## Self-hosting

Linktrail has no shared server — you run your **own** private backend.
**Zero-input deploy:** click Deploy to clone the repo into your Vercel + Git and
add the Neon integration (which sets `DATABASE_URL`) — no token fields to fill.
Then open `https://your-project.vercel.app/api/setup` **right away** and click
*Generate my tokens* (the first visitor claims the backend). Paste the shown
Backend URL + write token into the extension's options. The schema is created
automatically on first use.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/starfysh-tech/linktrail&project-name=linktrail&repository-name=linktrail&products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D)

Full walkthrough: [`docs/self-hosting.md`](docs/self-hosting.md).

## Develop

```sh
bun run build:ext   # builds to dist/extension/
bun run dev:ext     # same, in watch mode
```

Load it in Chrome: `chrome://extensions` → enable **Developer mode** →
**Load unpacked** → select `dist/extension/`. The pinned manifest `key` keeps the
extension ID stable across reloads, so stored config survives. Configure the
extension from its **options page**: enter the backend URL and write token, then
**Test connection**.

## Test

```sh
bun test                  # pure + auth tests, no DB
RUN_DB_TESTS=1 bun run test  # adds save/feed/verify round-trips vs real Neon
```

The DB-gated tests insert and then delete their own marker rows, so they are
repeatable and leave nothing behind. The test seams:

- **`lib/normalize`** (unit) — combinatorial URL cases; shared by both sides.
- **Backend HTTP endpoints** (integration) — save/feed/verify/status/items/setup as
  black boxes against a test Neon database; pure helpers behind them (`lib/config`,
  `lib/schema`) are unit-tested without a DB.
- **Extension capture decisions** (unit) — pure functions (is-capturable, payload
  assembly, response→state mapping, queue decisions) with `chrome.*`/`fetch` mocked.
- **Markdown extraction** (`extension/src/extract.ts`, unit) — `cleanDocument`
  noise/empty-alt stripping, GFM table conversion, filename derivation, gz cap.
- **Web review-app decisions** (`web/src/view.ts`, unit) — search/sort/date-filter,
  token parse, auth-state, the JSON/bookmark/OPML export serializers, the
  search/delete URL builders, and Mermaid-fence detection.

Impure glue (service worker, popup, options, web app wiring) is manual-verify —
including the in-page separator pass (`page-reader.ts`, needs live layout) and the
preview modal's rendered Markdown/diagrams. No E2E or visual tests.

## Deploy

```sh
vercel deploy --prod
```

Only `api/` (plus the shared `lib/`) deploys — the extension, tests, scripts, and
docs are excluded via `.vercelignore`. Production is aliased to
**`linktrail-alpha.vercel.app`**.

> **Vercel ESM gotcha:** under Node ESM on Vercel, relative imports in **all
> deployed code** must use explicit `.js` extensions (e.g. `import { ... } from
> "../lib/normalize.js"`), even though the source files are `.ts`. This covers
> `api/*` **and** any `lib/` file reached from them — including `lib → lib`
> imports (e.g. `lib/schema.ts` importing `./db.js`). An extensionless relative
> import resolves under Bun/tsc but crashes the function at runtime on Vercel.

## Endpoints

| Method | Path | Auth |
| ------ | ---- | ---- |
| `POST` | `/api/save` | `Authorization: Bearer <WRITE_TOKEN>`; body `{ url, title, markdownGz? }` (gzipped+base64 Markdown archive) |
| `GET`  | `/api/feed?token=<READ_TOKEN>` | read token in query string |
| `GET`  | `/api/verify` | `Authorization: Bearer <WRITE_TOKEN>` — health / connectivity check |
| `GET`  | `/api/status?url=<url>` | `Authorization: Bearer <WRITE_TOKEN>` — is this URL already saved? |
| `GET`  | `/api/items?token=<READ_TOKEN>` | read token — history JSON; `&q=` content search; `&id=<id>&format=md` downloads one item's archived Markdown |
| `DELETE` | `/api/items?id=<id>` | `Authorization: Bearer <WRITE_TOKEN>` — delete one item |
| `GET`/`POST` | `/api/setup` | none — first-run token reveal for env-less deploys (`POST` claims once; no-op if env tokens are set) |

## Conventions

- **Git:** commit and push directly to `main` (solo personal project; no feature
  branches or PRs).
- **Versioning:** bump the extension version when the **extension** changes,
  keeping `extension/manifest.config.ts` and `package.json` in sync. Backend-only
  or web-app-only changes do **not** bump. Current: **0.16.0**.
- **Secrets:** never committed — `.env.local` and `.secrets.local` are gitignored.
- **Auth:** two separate tokens — a bearer **write token** (save endpoint) and a
  distinct unguessable **read token** (in the feed URL).

## Design

A single deliberate dark material — **graphite with a warm amber accent** — across
both the popup and options page. The amber (systemOrange family) is the only
saturated color; the rest is neutral graphite glass with specular highlights and
grain. Light/dark parity is mandatory: the material stays graphite in both modes.

## Status

v1 (slices 1–5) plus the post-v1 enhancements are shipped — see `docs/issues/01–08`
and `CHANGELOG.md`:

- Review web app — search/browse your full history (slice 6).
- Self-hosting via a Deploy-to-Vercel button (slice 7).
- Zero-input deploy — first-run token reveal at `/api/setup` (slice 8).
- Offline retry queue, popup "already saved" hint, and `optional_host_permissions`.
- History backup & export (JSON / bookmarks / OPML) + CLI `export`/`import`.
- **Markdown archive on save** — a cleaned `.md` copy of each page (v0.14.0–0.16.0),
  with much-improved extraction for app-style pages.
- **Content search** over the archived Markdown, a **rendered preview** modal
  (with Mermaid diagrams), per-item **`.md` download**, and **delete**.

**Open:** the Chrome Web Store listing is still pre-publish — the new `scripting`
permission (added for Markdown extraction) needs its justification in the listing,
and the screenshots/assets should cover the new review-app features (see
`CHROMEWEBSTORE.md` and `TODO.md`).
