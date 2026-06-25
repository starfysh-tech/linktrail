# Slice 5 — Feedback & failure UX

## What to build

Complete, honest feedback for every capture outcome across both the silent shortcut
path and the popup, so the user always knows what happened and never silently loses
a page.

The toolbar badge reflects all six states with quiet success/duplicate indicators
that auto-clear after about two seconds; a Chrome notification fires only on
failure. Failures are distinguished and routed: a config/auth (4xx) failure shows
"Check settings" and routes to options, while a temporary network/server (5xx)
failure shows "Couldn't save, try again." Triggering capture again is the retry —
there is no queue. A client-side guard detects non-http(s) pages before any backend
call and shows a quiet "Can't save this page" state distinct from an error.

## Acceptance criteria

- [ ] The badge reflects saved, duplicate, failed, and not-capturable states and
      auto-clears successful/duplicate states after ~2s.
- [ ] A notification fires only on failure; success and duplicate stay badge-only.
- [ ] A 4xx config/auth failure shows "Check settings" and routes the user to
      options.
- [ ] A 5xx/network failure shows "Couldn't save, try again" and re-triggering
      capture retries.
- [ ] Triggering capture on a non-http(s) page skips the backend and shows a quiet
      "Can't save this page" state, distinct from a failure.
- [ ] A failed save leaves browser state untouched (no corruption, no partial save).

## Blocked by

- Slice 2 — Normalization, dedupe & backend hardening
- Slice 4 — Glass popup
