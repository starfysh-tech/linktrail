# Self-hosting Linktrail

Linktrail has no shared server — you run your **own** private backend. This guide
gets you a personal Linktrail backend (a few Vercel Functions + a Neon Postgres
database) in a handful of clicks, then points the published extension at it.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/starfysh-tech/linktrail&project-name=linktrail&repository-name=linktrail&env=WRITE_TOKEN,READ_TOKEN&envDescription=Two%20unguessable%20secrets%20%E2%80%94%20generate%20each%20with%20%60openssl%20rand%20-hex%2032%60&envLink=https://github.com/starfysh-tech/linktrail/blob/main/docs/self-hosting.md&products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D)

## Steps

1. **Click Deploy with Vercel** (above). Vercel clones the public
   `starfysh-tech/linktrail` repo into your Git provider and creates a new
   project, then prompts you to **add the Neon integration**. Accept it — Neon
   provisions a database and sets `DATABASE_URL` for you automatically.

2. **Generate your two tokens.** In a terminal, run `openssl rand -hex 32`
   twice to get two unguessable secrets, and paste them into the deploy form's
   env fields:
   - `WRITE_TOKEN` — the bearer token the extension uses to save pages.
   - `READ_TOKEN` — the token embedded in your private RSS feed / history URL.

   Use **different** values for the two; don't reuse one for both.

3. **Deploy.** That's it — there's no migration to run. The schema
   (`saved_items` table + its unique index) is **created automatically on the
   first request** to your backend, so your first save just works.

4. **Point the extension at your backend.** Open the Linktrail extension's
   **options** page and enter:
   - **Backend URL** — your new Vercel URL (e.g.
     `https://your-project.vercel.app`).
   - **Write token** — the `WRITE_TOKEN` you generated above.

   Click **Test connection**. On success it confirms connectivity and shows your
   **feed URL** (it carries your `READ_TOKEN`). The popup's **History** chip now
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

- **Keep both tokens secret.** Treat them like passwords.
- The **read token is embedded in your feed/history URL** — anyone with that URL
  can read your saved items. Share it only with tools you trust (your RSS
  reader), and rotate it (change `READ_TOKEN` in your Vercel project's env and
  redeploy) if it leaks.
- The **write token** lets a caller save items to your backend; keep it only in
  the extension's options.
