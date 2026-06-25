# Linktrail v1 — PRD

A Chrome extension that captures the current browser tab into a personal,
RSS-backed reading history, with a Vercel-hosted backend and a Neon Postgres
datastore. Apple-native ("Safari-adjacent glass") look and feel.

## Problem Statement

I constantly come across web pages worth keeping — articles, references, things
to read later — but the tools for holding onto them are wrong for me. Bookmarks
pile up into an unmanaged, unreadable list. Read-later apps want accounts, sync,
and a separate inbox to babysit. I don't want to open another app, organize
folders, or manage a service. I want to flag a page in under a second while I'm
browsing and have it flow into a feed I already read in my own RSS reader,
without ever thinking about where it's stored.

The friction has to be near zero: if saving a page takes more than a keystroke,
or makes me look at a separate surface, I won't do it consistently. And the
history has to be durable and private — it's a record of what I read, so it
can't live only in the browser, and it can't be publicly exposed if a URL leaks.

## Solution

Linktrail is a personal capture utility split across a thin Chrome extension and
a small Vercel backend.

From my perspective:

- I press a keyboard shortcut on any normal web page and it is **saved
  instantly** — no popup, no click. A toolbar badge flashes a quiet checkmark
  and disappears. If I'd rather see what I'm saving, I click the toolbar icon and
  a compact glass popup shows the page's favicon, title, and cleaned-up URL with
  a single **Save** button and an inline result.
- If I save the same page twice, it tells me calmly that it's **already saved** —
  that's a normal outcome, not an error.
- Everything I save appears, newest-first, in a **private RSS feed** I subscribe
  to in my normal reader. The feed URL carries an unguessable token so it's
  effectively private but works in any standard RSS reader.
- First-run setup is one short screen: backend URL, a personal write token, and a
  **Test connection** button. No account, no sign-in.
- When something goes wrong, it's honest and recoverable: a bad token or missing
  config routes me to settings; a temporary network/server failure tells me to
  try again. There's no silent loss — failures also raise a single notification.

The backend owns all the durable behavior — validation, URL normalization,
deduplication, persistence, and RSS rendering — so the extension stays a thin
client that just initiates capture and shows the result. The datastore is the
single source of truth; RSS is a generated read view.

## User Stories

### Capture — fast path
1. As a Linktrail user, I want to press a keyboard shortcut to save the current
   tab, so that I can capture a page without moving my hands to the mouse.
2. As a Linktrail user, I want the shortcut save to happen with no popup, so that
   capture never interrupts my reading.
3. As a Linktrail user, I want a quiet toolbar badge to confirm a save succeeded,
   so that I know it worked without a disruptive alert.
4. As a Linktrail user, I want the success badge to clear itself after a couple of
   seconds, so that my toolbar stays clean.
5. As a Linktrail user, I want a distinct quiet badge when the page was already
   saved, so that I understand it's a duplicate, not a failure.
6. As a Linktrail user, I want a clear badge plus a single notification when a
   save fails, so that I never silently lose a page I meant to keep.
7. As a Linktrail user, I want to rebind the keyboard shortcut, so that I can
   avoid conflicts with my other shortcuts.

### Capture — considered path (popup)
8. As a Linktrail user, I want to click the toolbar icon to open a popup, so that
   I can see the page before saving it.
9. As a Linktrail user, I want the popup to show the page's favicon, title, and a
   cleaned-up URL preview, so that I can confirm what I'm about to save.
10. As a Linktrail user, I want a single primary Save button in the popup, so that
    the next action is obvious.
11. As a Linktrail user, I want the popup to show the save result inline (saved /
    already saved / failed), so that I get feedback in the same surface.
12. As a Linktrail user, I want the popup to feel like a small native macOS
    utility, so that it fits beside Safari, Notes, and Reminders.
13. As a Linktrail user, I want secondary links to open my feed and settings from
    the popup, so that I can reach them without hunting.

### Non-capturable pages
14. As a Linktrail user, I want a quiet "Can't save this page" state when I trigger
    capture on a non-web page (chrome://, new tab, file://, view-source), so that
    I'm not confused by an error.
15. As a Linktrail user, I want the extension to skip the backend entirely for
    non-web pages, so that no junk reaches my history.

### Setup & configuration
16. As a new Linktrail user, I want a short first-run setup screen, so that I can
    start capturing in under a minute.
17. As a new Linktrail user, I want to enter only a backend URL and a write token,
    so that there's no account or sign-in to deal with.
18. As a new Linktrail user, I want a Test connection button that validates my URL
    and token before I rely on it, so that I'm not surprised by a failure later.
19. As a new Linktrail user, I want an actionable error if the connection test
    fails, so that I know what to fix.
20. As a Linktrail user, I want my configuration to roam across my Chrome profiles,
    so that I don't re-enter it on each machine.
21. As a Linktrail user, I want the options screen to show my current keyboard
    shortcut and a link to change it, so that I can see and recover the binding.
22. As a Linktrail user, I want the options screen to show my feed link, so that I
    can subscribe to it in my reader.

### Feed & reading
23. As a Linktrail user, I want a standard RSS feed of everything I've saved, so
    that I can read it in the RSS reader I already use.
24. As a Linktrail user, I want the feed ordered newest-first, so that my most
    recent captures are at the top.
25. As a Linktrail user, I want each feed item to link to the original page, so
    that I can open what I saved.
26. As a Linktrail user, I want each feed item to have a sensible title even when
    the page reported none, so that my feed is never full of blank entries.
27. As a Linktrail user, I want re-saving a page to not create a second feed item,
    so that my feed stays clean.
28. As a Linktrail user, I want my feed URL to be effectively private, so that my
    reading history isn't exposed if the URL is seen.

### Reliability & recovery
29. As a Linktrail user, I want a failed save to leave my browser state untouched,
    so that a network blip never corrupts anything.
30. As a Linktrail user, I want a config/auth error to route me toward settings, so
    that I can fix the real problem.
31. As a Linktrail user, I want a temporary failure to simply let me retry by
    triggering capture again, so that recovery is trivial.
32. As a Linktrail user, I want duplicate detection to ignore tracking parameters,
    so that the same article shared from different sources counts as one save.

### Privacy & ownership
33. As a Linktrail user, I want the backend to be the durable system of record, so
    that my history survives extension reinstalls and browser resets.
34. As a Linktrail user, I want separate tokens for writing and for reading the
    feed, so that I can share or rotate my read feed without exposing write access.

## Implementation Decisions

### Topology & repository
- Single repository (`starfysh-tech/linktrail`), **flat layout**: backend
  functions, a shared library, and the extension live as sibling top-level
  concerns. No workspace tooling.
- The shared library holds **URL normalization** and the **save-request contract
  types**, imported directly by both the extension build and the backend. This is
  deliberate: client and server must run *identical* normalization, or they would
  disagree on identity and create phantom duplicates.
- Vercel deploys from the repo root and only picks up the backend functions
  directory; the extension is not part of the deployment.

### Backend
- **Plain Vercel Functions in TypeScript** (no web framework). The system is a
  small set of endpoints; a framework would add build surface without benefit.
- Datastore: **Neon serverless Postgres** via the Vercel Marketplace, accessed
  with the HTTP-based serverless driver (well-suited to serverless functions).
  Note: Vercel's first-party Postgres/KV products no longer exist; Neon is the
  Marketplace equivalent.
- **Three endpoints**:
  - **Save** — accepts a capture request, authenticates the write token,
    validates the URL scheme, normalizes, and upserts. Returns one of:
    `saved`, `duplicate`, invalid-config/auth (4xx), temporary failure (5xx).
  - **Feed** — renders the RSS feed, authorized by an unguessable read token
    carried in the URL.
  - **Verify** — a minimal health/auth check used by the setup "Test connection"
    button; confirms the write token is valid and the datastore is reachable.
- **CORS is owned by the backend**: endpoints return permissive CORS headers and
  answer preflight, so the extension service worker can call a user-configured
  backend origin without any host permission.

### Authentication
- **Write**: a single static bearer token sent as an `Authorization: Bearer`
  header, held in a backend environment variable.
- **Read**: a *separate* unguessable token embedded in the feed URL path/query —
  the only approach that is both private and universally compatible with RSS
  readers (which generally cannot send custom auth headers). Rotating the read
  token means re-subscribing; it does not affect write access.

### Data model
- A saved item is a normalized record with: an identifier, the original URL, a
  normalized URL (the unique dedupe key), a title, and a capture timestamp.
- Favicon and display host are **derived in the UI** from the URL, not stored.
- No page description/excerpt is stored or scraped in v1.
- The schema is intended to grow later with notes, tags, summaries, and a
  processing status without changing the core capture path.

### URL normalization & dedupe (shared module)
- "Moderate" normalization, applied identically on both sides:
  - lowercase host; canonicalize scheme to `https` for the key; drop `www.`;
  - strip default ports; remove the `#fragment`; drop a trailing slash;
  - strip known tracking parameters (`utm_*`, `fbclid`, `gclid`, `ref`, `mc_*`),
    while **preserving meaningful query params** (e.g. `?id=`, `?v=`).
- The original URL is always preserved separately (it is the RSS link target);
  the normalized URL is the dedupe identity.
- Deduplication is enforced by a **unique constraint on the normalized URL plus
  an upsert**; a duplicate is a normal non-error outcome.

### Validation
- Only `http`/`https` URLs are acceptable. Enforced **both** client-side (skip the
  backend, show "Can't save this page") and server-side (reject with a clear 4xx
  so the datastore never receives junk even if the client guard is bypassed).
- **Title fallback** is enforced server-side: if the provided title is empty or
  whitespace, the normalized host is stored as the title.

### RSS rendering
- **RSS 2.0**, latest 50 items, newest-first.
- Per item: title = stored title; link = original URL; `guid` = normalized URL
  with `isPermaLink="false"` (stable identity so readers never duplicate an item);
  `pubDate` = the capture time (RFC-822) — this is intentionally *your capture
  time*, not the article's own publish date, because the feed is a reading
  history; description echoes the title (no scraping in v1).
- Static channel metadata (title "Linktrail", link, description).

### Extension
- **Chrome Manifest V3.** Apple look and feel achieved purely with CSS
  (`backdrop-filter` glass, SF font stack, CSS-variable theming). Safari is a
  possible future port, not v1.
- Build with **Vite + the CRXJS Vite plugin**: vanilla HTML/CSS + TypeScript, no
  UI framework. The popup's states are CSS classes toggled by a small controller.
- **Manifest permissions**: `activeTab`, `storage`, and a `commands` entry for the
  shortcut. No host permissions (the backend's CORS handles cross-origin).
- **Hybrid capture model**:
  - Keyboard shortcut → **one-step silent save** against the active tab, feedback
    via the toolbar **badge**.
  - Toolbar click → opens the **glass popup** (page card + Save + result strip +
    secondary links). The popup does **not** detect "already saved" on open in
    v1; clicking Save simply returns the duplicate outcome if applicable.
- **State model** (six states): ready, saving, saved, duplicate, failed,
  not-capturable. The same states drive the badge and the popup.
- **Feedback policy**: badge for all states (✓ / duplicate / failure, ~2s
  auto-clear); a Chrome **notification only on failure**.
- **Failure handling is stateless** — no retry queue. A 4xx routes the user to
  settings ("Check settings"); a 5xx/network error shows "Couldn't save, try
  again." Re-triggering capture is the retry.
- **Configuration** (backend URL, write token, read feed URL) stored in
  `chrome.storage.sync` so it roams across the user's Chrome profiles.
- **Default shortcut**: `Cmd+Shift+L` (macOS) / `Ctrl+Shift+L` (Windows/Linux),
  with the live binding surfaced in options alongside a link to Chrome's shortcut
  settings (the suggested key may not bind if Chrome/another extension claims it,
  so visible recovery matters).

### Visual design
- Single accent color: Apple **system blue `#0A84FF`** (cyan-shifted for
  hover/active), exposed as a CSS variable with light/dark variants.
- Glass material used **only** on the popup shell, the status pill, and settings
  cards — not on backgrounds, list rows, or text-heavy surfaces.
- **Light and dark mode parity is mandatory.**

### Distribution
- **Load unpacked** (developer mode) for v1, with a **pinned manifest `key`** so
  the extension ID stays stable across reloads (so `chrome.storage.sync` data and
  permission grants are not reset).

## Testing Decisions

Good tests here verify **external behavior at the highest practical seam**, not
implementation details: given an input request/URL/tab, assert the observable
output (HTTP response, datastore effect, rendered XML, or returned state), never
internal call sequences. There is **no existing test prior art** in this repo, so
these three seams establish the patterns.

### Seam 1 — Backend HTTP endpoints (integration)
- Drive Save, Feed, and Verify as **black boxes** against a **test Neon
  database**.
- Behaviors covered: write-token auth (accept/reject), read-token feed
  authorization, http/https validation (non-http rejected with 4xx), normalization
  + dedupe (re-saving a normalized-equivalent URL returns `duplicate` and does not
  create a second row), server-side host-fallback title, and RSS 2.0 output
  (item count cap, newest-first ordering, `guid`/`link`/`pubDate` correctness).
- This is the widest seam — one suite exercises validation, normalization,
  persistence, and rendering through the real public contract.

### Seam 2 — Shared normalization module (unit)
- A focused unit suite over the shared normalization function for the
  combinatorial URL cases: tracking-param stripping vs. preserved params, `www.`
  removal, https canonicalization, fragment/default-port/trailing-slash handling,
  and idempotency (normalizing a normalized URL is a no-op).
- Kept as a **separate seam** because this is the one module imported by *both*
  the extension and the backend; testing it directly protects both sides from the
  phantom-duplicate risk that a divergence would cause.

### Seam 3 — Extension capture decisions (unit)
- Pure functions only, with `chrome.*` and `fetch` mocked: "is this tab
  capturable?" (scheme check), capture-payload assembly, and the
  `response → badge/popup state` mapping (saved / duplicate / failed-4xx /
  failed-5xx / not-capturable).
- Tests assert the decision/output for given inputs, not the wiring.

## Out of Scope

- **AI summaries, content scraping/extraction, and scheduled enrichment** — the
  capture path stores only URL + title; no description is derived.
- **Notes, tags, and processing status** — schema is designed to accommodate them
  later, but they are not built in v1.
- **A web review/reading UI** — reading happens in the user's own RSS reader. A
  future review UI (possibly a Next.js migration) is deferred.
- **Offline capture queue and automatic retries** — v1 is stateless; the user
  re-triggers to retry. A single auto-retry and a durable offline queue are
  backlog items.
- **Popup "already saved on open" detection** — deferred (would require a read/
  status endpoint).
- **Safari / cross-browser builds** — Chrome MV3 only in v1.
- **Chrome Web Store distribution and auto-update** — load-unpacked only in v1;
  unlisted Web Store is a backlog item.
- **`optional_host_permissions` runtime grant** — v1 relies on backend CORS
  instead; switching is a backlog item.
- **Multi-user / sharing / accounts** — single personal user, token-based.
- **End-to-end / visual UI tests** — popup visuals and live browser behavior are
  not automatically tested in v1.

## Further Notes

- Hosting target is **Vercel Hobby** for personal, non-commercial use; the design
  deliberately avoids any cron dependency because capture is event-driven.
- The design resolves a tension between the source documents: the user-flow doc
  described instant shortcut capture, while the UI doc treated the popup as the
  primary surface. The **hybrid** model honors both — shortcut for speed, popup
  for the considered, glass UI.
- The "Apple-native" direction is an **aesthetic applied to a Chrome extension**,
  not a Safari/platform commitment.
- Backlog (deferred from v1), for future PRDs: resilience (single auto-retry +
  durable offline queue), `optional_host_permissions`, unlisted Web Store
  distribution, popup "already saved on open" detection, and the future review UI
  with notes/tags/summaries/status columns.
