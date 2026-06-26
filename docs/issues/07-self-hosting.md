# Slice 7 — Self-hosting (one-click backend for any user)

## What to build

Let anyone run their **own** Linktrail backend (Vercel + Neon) from the published
extension, with a near one-click "Deploy to Vercel" flow — no terminal, no manual
migration. The extension is already BYO-backend (options take a backend URL +
write token), so there is **no per-user extension build**; this slice removes the
remaining manual backend steps.

### Target user
Developer-comfortable: can make Vercel + Neon accounts and click through the
Vercel project-creation flow. Goal is a handful of clicks.

### The user's flow
1. Click **Deploy to Vercel** (clones the public `starfysh-tech/linktrail` repo
   into their Git + Vercel).
2. The deploy flow **adds the Neon native integration** → `DATABASE_URL` set
   automatically.
3. They paste **`WRITE_TOKEN`** and **`READ_TOKEN`** (two random strings) into the
   deploy form's env fields.
4. First request **auto-creates the schema** (`ensureSchema()`) — nothing to run.
5. In the extension options: enter the new backend URL + write token → **Test**
   returns the feed URL; the **History** chip then works.

## Decisions (locked)

- **Auth unchanged:** env-var tokens (`WRITE_TOKEN`, `READ_TOKEN`). No DB token
  store, no auth rewrite.
- **DB provisioning:** Neon **Vercel-managed** integration, attached via the
  deploy button's `products=` parameter. Neon injects `DATABASE_URL` (pooled),
  which is exactly what `lib/db.ts` reads. (Verified against Vercel's Neon
  template + Neon docs, 2026-06.)
- **Migration:** lazy, in-code `ensureSchema()` — `CREATE TABLE IF NOT EXISTS
  saved_items …` + `CREATE UNIQUE INDEX IF NOT EXISTS saved_items_normalized_url_key`.
  **Memoized once per serverless instance** (a module-level promise) and awaited
  at the top of every DB-touching endpoint (`save`, `feed`, `status`, `items`) —
  the unique index must exist before `save`'s `ON CONFLICT`. The heavy
  backfill/dedupe stays in `scripts/migrate.ts` for the dev only.
- **Distribution:** the existing **public** repo; no separate template.
- **Onboarding:** `docs/self-hosting.md` (button + steps), button on README +
  landing, and a **"Need a backend? Deploy one →"** link on the extension options
  page.

### The Deploy Button URL (use verbatim)
```
https://vercel.com/new/clone?repository-url=https://github.com/starfysh-tech/linktrail&project-name=linktrail&repository-name=linktrail&env=WRITE_TOKEN,READ_TOKEN&envDescription=Two%20unguessable%20secrets%20%E2%80%94%20generate%20each%20with%20%60openssl%20rand%20-hex%2032%60&envLink=https://github.com/starfysh-tech/linktrail/blob/main/docs/self-hosting.md&products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D
```
Markdown badge:
`[![Deploy with Vercel](https://vercel.com/button)](<the URL above>)`

## Acceptance criteria

- [ ] `lib/schema.ts` exports `ensureSchema()` that creates the table + unique
      index idempotently and runs its DDL **at most once per process** (memoized).
- [ ] `save`, `feed`, `status`, `items` await `ensureSchema()` before their first
      query; a save against a brand-new (empty) database succeeds with no manual
      migration.
- [ ] `ensureSchema()` is safe to call concurrently and repeatedly (idempotent).
- [ ] `docs/self-hosting.md` documents the flow with the Deploy button, token
      generation (`openssl rand -hex 32`), and how to configure the extension.
- [ ] The Deploy button appears on the README and the landing page.
- [ ] The extension options page shows a "Need a backend? Deploy one →" link to
      the self-hosting guide.
- [ ] No secret is committed; the public repo carries no `.vercel`/`.env*`/
      `.secrets.local`/`.keys` (already gitignored — verify still true).

## Testing seams

- **New pure/seam-friendly memoization (`lib/schema.ts`):** `ensureSchema` takes
  an optional injected runner (default: the real DDL via `sql`) so a **no-DB unit
  test** can assert the runner is invoked **once** across multiple concurrent
  calls (memoization), with no chrome/DB needed.
- **Seam 1 (DB-gated integration):** a test that `ensureSchema()` makes
  `saved_items` exist (`SELECT to_regclass('saved_items')` is non-null) and is
  idempotent on a second call. Mirrors `tests/api.test.ts` gating
  (`RUN_DB_TESTS`).

## Out of scope (v1)

- DB-stored / auto-generated tokens and a `/setup` claim flow (kept env-var auth).
- A hosted/managed shared backend (contradicts the self-hosted model).
- Non-technical / zero-account onboarding.
- Any per-user extension build or store-listing change beyond noting self-hosting.

## Blocked by

- Slice 2 — backend hardening (the `saved_items` schema this codifies).
- Slice 6 — review app (`web/` is part of what a self-hoster deploys).
