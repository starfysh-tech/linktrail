# Slice 1 — Capture spine (tracer bullet)

## What to build

The thinnest complete, end-to-end capture path through every layer, so that a
keyboard shortcut turns the current tab into an item visible in an RSS reader.

Pressing the keyboard shortcut makes the extension service worker read the active
tab's URL and title, send a save request to the backend with the write token, and
the backend normalizes the URL (basic normalization is sufficient at this stage),
inserts a record into Neon Postgres, and the RSS feed endpoint renders that record
so it appears in a standard RSS reader. A minimal success badge confirms the save.

This slice stands up the minimal scaffold of **both** deployables (Chrome MV3
extension via Vite + CRXJS; plain Vercel TypeScript functions), the Neon schema,
the write token (bearer) and read token (in the feed URL), and a pinned manifest
`key` so the extension ID is stable. Configuration (backend URL + write token) is
read from extension storage but may be set manually for now — there is no options
UI in this slice.

## Acceptance criteria

- [ ] Repo has the flat layout: backend functions, a shared library, and the
      extension as sibling concerns; Vercel deploys from root and picks up only the
      functions directory.
- [ ] Neon Postgres is connected via the serverless HTTP driver; a saved-items
      table exists with id, original url, normalized url, title, and capture time.
- [ ] The save endpoint authenticates a static bearer write token and rejects
      requests without it.
- [ ] Triggering the keyboard shortcut on a normal web page saves the active tab's
      URL + title to the datastore.
- [ ] The feed endpoint renders RSS 2.0, authorized by an unguessable read token in
      the URL, newest-first, with each item linking to the original URL.
- [ ] A captured page appears in a standard RSS reader subscribed to the feed URL.
- [ ] A minimal success badge appears on the toolbar after a successful save.
- [ ] The manifest pins a `key` so the extension ID is stable across reloads.

## Blocked by

None — can start immediately.
