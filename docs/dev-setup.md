# Dev setup & manual verification

How to build, deploy, load, and verify Linktrail locally. The automated suites
(`bun test`) cover normalization, capture decisions, and the backend HTTP
contract; the steps here cover the inherently-manual bits (a real Chrome profile
and a real RSS reader).

## One-time

```sh
bun install
# Pull the PRODUCTION env — Neon's Marketplace vars (DATABASE_URL) only exist in
# Production/Preview, NOT development, so a plain `vercel env pull` drops them.
vercel env pull .env.local --environment=production
bun run migrate                 # create the saved_items table in Neon
```

> The `test`/`migrate` scripts load `.env.local` explicitly via `bun --env-file`
> (Bun does not auto-load `.env.local` under its test env convention).

## Tests

```sh
bun test                        # all pure + auth tests (no DB writes)
RUN_DB_TESTS=1 bun test         # also runs the save↔feed round-trip vs real Neon
```

The DB-gated tests insert and then delete their own marker rows, so they are
repeatable and leave nothing behind.

## Backend

```sh
vercel deploy                   # preview URL, e.g. https://linktrail-xxxx.vercel.app
vercel deploy --prod            # production URL
```

The deployment serves only the functions in `api/` (the extension is excluded
via `.vercelignore`). Endpoints:

- `POST /api/save` — header `Authorization: Bearer <WRITE_TOKEN>`, body `{ url, title }`.
- `GET  /api/feed?token=<READ_TOKEN>` — RSS 2.0, newest-first.

## Extension (load unpacked)

```sh
bun run build:ext               # builds to dist/extension/
```

1. Chrome → `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select `dist/extension/`. The pinned manifest `key` keeps
   the extension ID stable across reloads, so stored config survives.
3. Seed config (no options UI until Slice 3). Open the service worker's console
   from the extension card (**Inspect views: service worker**) and run:
   ```js
   chrome.storage.sync.set({
     backendUrl: "https://<your-deployment>.vercel.app",
     writeToken: "<WRITE_TOKEN>",
   });
   ```

## Verify the capture spine (Slice 1)

1. Navigate to any normal `https://` page.
2. Press the shortcut (**⌘⇧L** on macOS, **Ctrl+Shift+L** elsewhere). Confirm/rebind
   at `chrome://extensions/shortcuts` if it didn't bind.
3. A **✓** badge appears on the toolbar icon and clears after ~2s.
4. On a `chrome://` or new-tab page, the shortcut shows a quiet **—** (skipped, no
   backend call).
5. Subscribe your RSS reader to `https://<deployment>/api/feed?token=<READ_TOKEN>`
   and confirm the page appears, newest-first, linking to the original URL.
