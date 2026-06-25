# Slice 3 — Setup & options

## What to build

A short first-run setup experience so a new user can configure and validate the
extension in under a minute without an account.

The options page lets the user enter the backend URL and write token, run a **Test
connection** that calls a dedicated verify endpoint, and see their feed link and
keyboard-shortcut guidance. The verify endpoint confirms the write token is valid
and the datastore is reachable. Configuration is stored in `chrome.storage.sync`
so it roams across the user's Chrome profiles, replacing the manual config from
Slice 1.

Test connection produces an actionable error when the URL or token is wrong. The
shortcut guidance shows the current binding and links to Chrome's shortcut settings
so the user can see and change it (and recover if the suggested default did not
bind).

## Acceptance criteria

- [ ] A verify endpoint validates the write token and datastore reachability and
      returns a clear ok/error result.
- [ ] The options page accepts backend URL and write token and persists them to
      `chrome.storage.sync`.
- [ ] Test connection calls the verify endpoint and shows success or an actionable
      error.
- [ ] The options page displays the feed link for subscribing in a reader.
- [ ] The options page shows the current keyboard shortcut and links to Chrome's
      shortcut settings.
- [ ] After setup, capture (Slice 1) uses the stored config rather than manual
      values.

## Blocked by

- Slice 1 — Capture spine
