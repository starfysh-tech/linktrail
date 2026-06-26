# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Linktrail: a Chrome (Manifest V3) extension that captures the current browser tab
into a personal, RSS-backed reading history, with a Vercel-hosted backend and a
Neon Postgres datastore. Apple-native ("Safari-adjacent glass") look and feel.

The project is in the build-out phase. The authoritative spec lives in:
- `@docs/prd-v1.md` — full PRD (problem, user stories, decisions, test seams, scope)
- `docs/issues/01–08` — implementation slices. `01–05` are v1 (dependency order
  `1 → {2,3,4} → 5`); `06` review UI, `07` self-hosting, `08` zero-input setup are
  post-v1 enhancements. Each is a demoable vertical slice.

## Locked technical decisions (don't substitute alternatives)

These were deliberately chosen — do not reach for the more "default" option:
- **Backend = plain Vercel Functions in TypeScript.** NOT Next.js / no web framework.
- **Datastore = Neon serverless Postgres** via the Vercel Marketplace, using the
  `@neondatabase/serverless` HTTP driver. NOTE: Vercel Postgres/KV no longer exist
  as first-party products — don't suggest them.
- **Extension UI = vanilla HTML/CSS + TypeScript**, bundled with Vite +
  `@crxjs/vite-plugin`. NO React or other UI framework. Glass via CSS
  `backdrop-filter`; single accent `#0A84FF`; light/dark parity is mandatory.
- **Repo layout = flat single repo**: backend functions, a shared `lib/`, and the
  extension as sibling top-level concerns. NOT a workspaces monorepo.

## Critical gotchas

URL **normalization is shared code** imported by BOTH the extension and the
backend (`lib/`). The two sides MUST run identical normalization — if they
diverge, they compute different identities and create phantom duplicate captures.
Never fork or reimplement normalization per side.

**Vercel ESM `.js` extensions** — every relative import in *deployed* code must
carry an explicit `.js` extension (e.g. `import { sql } from "./db.js"`), because
Node ESM on Vercel won't resolve extensionless relative imports at runtime. This
applies to `api/*` **and** any `lib/` file reached from them, including `lib → lib`
imports. Extensionless imports still pass Bun + `tsc` (bundler resolution), so the
break only shows up as a 500 in production — always smoke-test endpoints after a
deploy.

## Conventions

- **Git workflow: commit and push directly to `main`** (solo personal project; no
  feature branches or PRs required).
- **Versioning: bump the minor per slice** (`0.<slice>.0`), keeping
  `extension/manifest.config.ts` and `package.json` in sync. Do it in the slice's
  commit so Chrome sees a new version on reload.
- **Secrets/local dev**: pull env with `vercel env pull .env.local`. `.env.local`
  is gitignored. Expected vars: `DATABASE_URL` (Neon), write token, read token.
  Never commit secrets.
- **Auth model**: two separate tokens — a bearer write token (save endpoint) and a
  distinct unguessable read token carried in the RSS feed URL.

## Testing seams (the only places to test — see PRD for detail)

1. **Backend HTTP endpoints** (integration) — drive save/feed/verify/status/items/
   setup as black boxes against a test Neon database (DB tests gated behind
   `RUN_DB_TESTS`). Pure helpers behind them (`lib/config` `pickTokens`,
   `lib/schema` memoization) are unit-tested without a DB.
2. **`lib/normalize`** (unit) — combinatorial URL cases; shared by both sides.
3. **Extension capture decisions** (unit) — pure functions (is-capturable, payload
   assembly, response→state mapping, queue decisions) with `chrome.*` and `fetch`
   mocked.
4. **Web review-app decisions** (`web/src/view.ts`, unit) — search/sort/date-filter,
   token parse, auth-state, and the JSON/bookmark/OPML export serializers.

Test external behavior, not implementation details. Impure glue (service worker,
popup, options, queue, web app wiring) is manual-verify. No E2E/visual tests.
