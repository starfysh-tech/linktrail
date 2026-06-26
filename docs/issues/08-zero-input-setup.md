# Slice 8 — Zero-input deploy (first-run token reveal)

## What to build

Make self-hosting deploy with **no token input at all** — only the Neon
integration. Tokens are generated server-side on first run and revealed once via
`/api/setup` (trust-on-first-use), then used for auth. The deployer opens
`/api/setup` immediately after deploy to claim + copy their write token.

## Decisions (locked)

- **Backward compatible (critical):** auth resolves tokens as
  `process.env.WRITE_TOKEN ?? db.write_token` (and read likewise). Our existing
  prod sets env tokens, so it is **unchanged**; only fresh, env-less deploys use
  DB-stored tokens. If a token's env var is present, the DB is not consulted for
  it (so the no-DB auth tests never hit the datastore).
- **Single-row `config` table** (`id=1` singleton): `write_token`, `read_token`,
  `claimed_at`. Created by `ensureSchema()`.
- **Atomic claim:** `INSERT INTO config (id, ...) VALUES (1, ...) ON CONFLICT (id)
  DO NOTHING RETURNING ...` — exactly one claimant wins even under concurrency.
  Returns the tokens only to the claimant; a second claim returns nothing.
- **TOFU race:** the window is deploy → the owner's first `/api/setup` visit;
  documented with "open /setup now" guidance. Claiming is a **POST** (button
  click), never a GET side effect, so prefetchers/bots don't claim.
- **`/api/setup`:** `GET` renders a small self-contained HTML page; if the backend
  is env-configured it explains that (no reveal); if unclaimed it offers a
  "Generate my tokens" button (POST); if claimed it says so. `POST` claims and
  returns the write token + feed URL for display.
- **Token generation:** `crypto.randomBytes(32).toString("hex")` (Node runtime),
  one per token.

## Acceptance criteria

- [ ] With `WRITE_TOKEN` + `READ_TOKEN` set in env, auth behaves exactly as before
      and `/api/setup` reveals nothing (env-configured message). No DB read for
      tokens when env provides them.
- [ ] On an env-less backend, the first `POST /api/setup` generates + stores +
      returns both tokens; a second `POST` returns no tokens (already claimed).
- [ ] After claim, `save`/`verify`/`status` accept the DB write token and
      `feed`/`items` accept the DB read token.
- [ ] `GET /api/setup` never mutates; claiming requires `POST`.
- [ ] Deploy requires **zero** token env input (only the Neon integration).

## Testing seams

- **Pure (`lib/config.ts`):** `pickTokens(envWrite, envRead, dbRow)` — env-over-DB
  precedence — unit-tested with no DB.
- **DB-gated (Seam 1):** `claimTokens()` — first call returns distinct tokens,
  second returns null (atomic lock); cleanup deletes the singleton row. `/api/setup`
  env-configured branch (env tokens present → no reveal).

## Out of scope

- Token rotation UI (a later authenticated rotate endpoint).
- Removing env-var support (kept for backward compat + advanced users).

## Blocked by

- Slice 7 — self-hosting (the deploy flow this removes the token step from).
