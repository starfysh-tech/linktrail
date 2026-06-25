# Linktrail

Linktrail is a Chrome (Manifest V3) extension that captures the current browser
tab into a personal, RSS-backed reading history. A keyboard shortcut saves the
page silently; the toolbar button opens a glass popup for a deliberate save.
Captures land in a Neon Postgres datastore behind a small set of Vercel
Functions, and flow back out as an RSS feed you subscribe to in any reader. The
extension is intentionally thin — vanilla HTML/CSS + TypeScript, no UI framework —
with an Apple-native graphite-and-warm-amber "glass" look.

**Links:** [Landing page](https://starfysh-tech.github.io/linktrail/) ·
[Privacy policy](https://starfysh-tech.github.io/linktrail/privacy.html) ·
[Web Store listing prep](CHROMEWEBSTORE.md)

## How it works

The capture flow:

- **Shortcut** (`⌘⇧L` / `Ctrl+Shift+L`) → silent save, with a `✓` badge on the
  toolbar icon (a quiet `—` on non-capturable pages like `chrome://`).
- **Toolbar button** → a graphite glass popup for a deliberate, visible save.

Both paths POST to **`/api/save`**, which:

1. Authenticates the request against the bearer **write token**.
2. **Normalizes** the URL to a canonical identity.
3. **Upserts** into Neon — same identity = same row, so re-saving dedupes
   instead of creating phantom duplicates.

Saved items are served back as RSS 2.0 (newest-first) from **`/api/feed`**,
guarded by an unguessable **read token** carried in the feed URL.

> **Shared normalization (critical):** `lib/normalize.ts` is imported by **both**
> the extension and the backend. Both sides must compute the *identical* canonical
> URL — if they diverge they compute different identities and create phantom
> duplicate captures. Never fork or reimplement normalization per side.

## Layout

A flat single repo — backend functions, a shared `lib/`, and the extension are
sibling top-level concerns (not a workspaces monorepo).

```
api/         Vercel Functions (the only thing deployed)
  save.ts    POST — auth, normalize, dedupe upsert
  feed.ts    GET  — RSS 2.0 feed, read-token guarded
  verify.ts  GET  — health/connectivity check
lib/         Shared code (imported by api/ and extension/)
  normalize.ts  canonical URL identity — shared by BOTH sides
  contract.ts   request/response shapes
  cors.ts       CORS handling
  db.ts         Neon HTTP-driver access
  load-env.ts   loads .env.local + .secrets.local for scripts/tests
extension/   MV3 extension (Vite + @crxjs/vite-plugin)
  manifest.config.ts            manifest (pinned key → stable extension ID)
  popup.html / options.html     entry pages
  src/{sw,popup,options,capture}.ts + css, icons/
scripts/
  migrate.ts        create the saved_items table
  reset-items.ts    clear saved items
tests/       The three test seams (see Test)
docs/
  prd-v1.md         authoritative PRD
  dev-setup.md       full setup + manual verify flow
  issues/01–05       the five implementation slices
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
repeatable and leave nothing behind. There are three test seams (and only three):

- **`lib/normalize`** (unit) — combinatorial URL cases; shared by both sides.
- **Backend HTTP endpoints** (integration) — save/feed/verify as black boxes
  against a test Neon database.
- **Extension capture decisions** (unit) — pure functions (is-capturable, payload
  assembly, response→state mapping) with `chrome.*` and `fetch` mocked.

No E2E or visual tests in v1.

## Deploy

```sh
vercel deploy --prod
```

Only `api/` (plus the shared `lib/`) deploys — the extension, tests, scripts, and
docs are excluded via `.vercelignore`. Production is aliased to
**`linktrail-alpha.vercel.app`**.

> **Vercel ESM gotcha:** under Node ESM on Vercel, relative imports in `api/*`
> must use explicit `.js` extensions (e.g. `import { ... } from "../lib/normalize.js"`),
> even though the source files are `.ts`.

## Endpoints

| Method | Path | Auth |
| ------ | ---- | ---- |
| `POST` | `/api/save` | `Authorization: Bearer <WRITE_TOKEN>`; body `{ url, title }` |
| `GET`  | `/api/feed?token=<READ_TOKEN>` | read token in query string |
| `GET`  | `/api/verify` | health / connectivity check |

## Conventions

- **Git:** commit and push directly to `main` (solo personal project; no feature
  branches or PRs).
- **Versioning:** bump the minor per slice (`0.<slice>.0`), keeping
  `extension/manifest.config.ts` and `package.json` in sync. Current: **0.8.0**.
- **Secrets:** never committed — `.env.local` and `.secrets.local` are gitignored.
- **Auth:** two separate tokens — a bearer **write token** (save endpoint) and a
  distinct unguessable **read token** (in the feed URL).

## Design

A single deliberate dark material — **graphite with a warm amber accent** — across
both the popup and options page. The amber (systemOrange family) is the only
saturated color; the rest is neutral graphite glass with specular highlights and
grain. Light/dark parity is mandatory: the material stays graphite in both modes.

## Status & backlog

v1 slices 1–5 are shipped. Backlog:

- Offline retry queue for failed captures.
- Popup "already saved" state on open.
- Unlisted Chrome Web Store distribution.
- `optional_host_permissions` instead of broad host access.
- A future review UI (notes / tags / summaries).
