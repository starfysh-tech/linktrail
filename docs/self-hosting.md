# Self-hosting Linktrail

Linktrail has no shared server — you run your **own** private backend. This guide
gets you a personal Linktrail backend (a few Vercel Functions + a Neon Postgres
database) in a handful of clicks, then points the published extension at it.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/starfysh-tech/linktrail&project-name=linktrail&repository-name=linktrail&products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D)

## Steps

1. **Click Deploy with Vercel** (above). Vercel clones the public
   `starfysh-tech/linktrail` repo into your Git provider and creates a new
   project, then prompts you to **add the Neon integration**. Accept it — Neon
   provisions a database and sets `DATABASE_URL` automatically. **There are no
   token fields to fill in** — just deploy.

2. **Open your setup page right away.** As soon as the deploy finishes, visit
   **`https://your-project.vercel.app/api/setup`** and click **Generate my
   tokens**. It creates your backend's tokens and shows your **Backend URL**,
   **Write token**, and **Feed URL** — copy them now; this page only shows them
   once.

   > ⚠️ Do this immediately. The first visitor to claim a fresh backend owns it,
   > so don't leave a deployed-but-unclaimed backend sitting around. (There's no
   > migration to run — the schema is created automatically on first use.)

3. **Point the extension at your backend.** Open the Linktrail extension's
   **options** page and enter:
   - **Backend URL** — your Vercel URL (e.g. `https://your-project.vercel.app`).
   - **Write token** — the one your setup page just showed you.

   Click **Test connection**. On success it confirms connectivity and shows your
   **feed URL** (it carries your read token). The popup's **History** chip now
   opens your private review app at `…/app/`, and your RSS feed is ready to
   subscribe to in any reader.

## What you get (and what it costs)

Everything is yours — your repo, your Vercel project, your Neon database, your
tokens. Nobody else can read your history, and there is no shared service to
trust.

- **Neon** runs comfortably on its **free tier** for a personal reading history.
- **Vercel** runs on the **Hobby** plan for personal, non-commercial use.

## Back up your history

Your saved pages live only in your Neon database, so keep your own copy:

- **In the app:** open the review app (the popup's **History** chip) and use the
  **Export** buttons — **JSON** (re-importable), **HTML bookmarks** (browsers and
  read-later apps import these), or **OPML**.
- **From the repo (full backup / migrating backends):** `bun run export` writes a
  JSON backup; `bun run import <file.json>` restores it into any Linktrail backend
  (idempotent, so it merges safely). See [`dev-setup.md`](dev-setup.md).

## Security

- **Claim immediately after deploy.** Tokens are generated on the first
  `POST /api/setup` and shown once; until then the backend is unclaimed.
- **Keep both tokens secret.** Treat them like passwords.
- The **read token is embedded in your feed/history URL** — anyone with that URL
  can read your saved items. Share it only with tools you trust (your RSS reader).
- The **write token** lets a caller save items to your backend; keep it only in
  the extension's options.
- **Rotating / overriding tokens:** set `WRITE_TOKEN` and/or `READ_TOKEN` as
  environment variables in your Vercel project and redeploy — env vars always
  **override** the generated ones. (Advanced users can also pre-set these at
  deploy to skip `/api/setup` entirely.)
