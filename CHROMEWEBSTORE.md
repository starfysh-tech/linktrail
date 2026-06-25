# Chrome Web Store Listing — Linktrail

> Last Updated: 2026-06-25

## Store Listing

**Extension Name**

Linktrail

**Short Description**

Save the current tab to your own private, RSS-based reading history — one keyboard shortcut, no account.

**Detailed Description**

Linktrail saves the page you're on to your own private reading history that you read back as an RSS feed.

WHAT IT DOES
Every page you save — its title and address — lands newest-first in a personal RSS feed that only you can reach. Open that feed in whatever RSS reader you already use, and your saved pages show up alongside everything else you follow. It's a "read it later" list that lives where your reading already happens, instead of in yet another app.

There's no account and no sign-in. You point Linktrail at your own private backend once, and everything you save stays yours.

FEATURES
• One-tap save from the toolbar — click the icon, glance at the page title, and hit Save.
• Instant keyboard save — press the shortcut (Ctrl+Shift+L, or Command+Shift+L on Mac) and the page is saved silently, with a small badge to confirm.
• Your reading history as an RSS feed — saved pages appear newest-first in a private feed you subscribe to in your own reader.
• Search your whole history — a private web view (opened from the popup's History button) lets you search and browse everything you've ever saved, not just the latest items.
• Private by design — your saved pages go only to a backend you set up and own. There's no shared Linktrail server.
• Settings that follow you — your setup is remembered across the Chrome profiles you sign into, so you only configure it once.
• Never lose a save — if a page can't reach your backend (you're offline, or it's briefly down), it's queued and retried automatically until it goes through.
• Knows what you've kept — opening the popup on a page you've already saved shows a subtle "already in your trail" hint, so you don't save it twice.
• Light and dark, native feel — a clean, glass-style interface that matches your system appearance.

HOW TO USE
1. Open Linktrail's options page and enter your backend address and your write token (a one-time setup).
2. Paste your private feed address into your RSS reader.
3. From then on: click the toolbar icon and press Save, or just press Ctrl+Shift+L (Command+Shift+L on Mac) to save the current tab instantly.
4. Read your saved pages, newest-first, in your RSS reader.

PRIVACY
Linktrail does not run a shared server, does not collect analytics, and does not sell or share your data. The only information saved is each page's address, its title, and the time you saved it — and that information is sent only to the backend you set up and control. Your setup (your backend address, your write token, and your feed address) is stored by Chrome so it can follow you across your Chrome profiles. See the privacy policy linked below.

PERMISSIONS
• "Read the current tab" (activeTab) — used only when you click the toolbar icon or press the shortcut, to read the open page's address and title so it can be saved. Linktrail never watches your tabs in the background.
• "Storage" — remembers your backend address, write token, and feed address so you don't re-enter them on every computer.
• "Notifications" — shows a brief message if a save needs your attention or when queued pages finish syncing, so you're never left guessing.
• "Alarms" — lets Linktrail periodically retry saves that were queued while you were offline, even when the popup is closed.

SUPPORT
Questions, bugs, or suggestions? Open an issue on the project's GitHub repository or email the address on this listing.

Version 0.8.1 — Initial release: toolbar save, keyboard-shortcut save, and private RSS reading history.

**Category**

Productivity

**Single Purpose**

Saves the current browser tab's URL and title to the user's own private, RSS-backed reading history.

**Primary Language**

English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `extension/icons/128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 | ✅ Created | `store-assets/screenshot-1.png` (Capture) |
| Screenshot 2 [RECOMMENDED] | 1280×800 | ✅ Created | `store-assets/screenshot-2.png` (Setup) |
| Screenshot 3 [RECOMMENDED] | 1280×800 | ✅ Created | `store-assets/screenshot-3.png` (Read) |
| Small Promo Tile [RECOMMENDED] | 440×280 | ✅ Created | `store-assets/promo-small-440x280.png` |
| Marquee Promo Tile | 1400×560 | ⬜ Optional | (only needed if featured) |

### Screenshot Notes

The three required/recommended screenshots are generated at exactly 1280×800 and
live in `store-assets/` (regenerate with the `store-assets/shot*.html` sources via
headless Chrome). They use the extension's single graphite + warm-amber glass
theme (the popup/options are intentionally graphite in both light and dark, so
there are no separate light/dark shots).

1. **`screenshot-1.png` — Capture**: the toolbar popup (favicon tile, page title, amber Save, Feed/Settings chips) beside "Flag a page in a keystroke." The primary "what you do" shot.
2. **`screenshot-2.png` — Setup**: the options Connection card (backend URL + write token, redacted; Save + Test connection; "Connected.") beside "Your data, your backend." No real token shown.
3. **`screenshot-3.png` — Read**: a generic RSS-reader view of saved pages newest-first beside "Read it in your own RSS." No third-party brand logos.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| activeTab | permissions | Reads the current tab's URL and title only at the moment the user explicitly triggers a save — either clicking the toolbar icon or pressing the keyboard shortcut — so that page can be added to their reading history. The extension has no background or continuous access to tabs and reads nothing until the user acts. |
| storage | permissions | Persists the user's own configuration — their backend URL, write token, and feed URL — using `chrome.storage.sync` so the one-time setup roams across the user's Chrome profiles and does not have to be re-entered on each machine. No browsing data or page content is stored. |
| notifications | permissions | Shows a brief notification when a save needs the user's attention (e.g. a misconfiguration), is queued because the backend was unreachable, or when previously-queued pages finish syncing. Never used for marketing, promotions, or recurring alerts. |
| alarms | permissions | Schedules a periodic background retry of saves that were queued while the user was offline or the backend was briefly unreachable, so a flagged page eventually reaches the user's trail without manual action. Used only for this retry timer — no tracking or scheduled content. |

| optional_host_permissions | optional host | Declared broad (`https://*/*`, `http://localhost/*`) but NEVER granted at install. At runtime, from the options page, the extension requests access to ONLY the single backend origin the user typed in — so it can reach a self-hosted backend that doesn't send permissive CORS. The default backend already sends CORS, so this is additive; if the user denies it, saving still works via CORS. No broad host access is ever exercised. |

> No host access is granted at install. `optional_host_permissions` is declared broad only because the backend origin is user-supplied and unknown at build time; the actual runtime grant is narrowed to the one origin the user enters in settings. The user's backend remains free to send permissive CORS (the default Vercel backend does), in which case no grant is needed.

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes — but only the page URL, page title, and capture timestamp, and only transmitted to a backend the user themselves configures and owns. The Linktrail publisher operates no server and receives nothing.

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | — | — | No |
| Health info | No | — | — | No |
| Financial info | No | — | — | No |
| Authentication info | No (the user's write/read tokens are config the user supplies, not collected from them) | Stored via `chrome.storage.sync`; write token is sent to the user's own backend to authorize saves | Authorize saves to the user's own backend | No |
| Personal communications | No | — | — | No |
| Location | No | — | — | No |
| Web history | Yes — the URL and title of pages the user explicitly chooses to save (not browsing history at large) | Yes — sent only to the user's own configured backend | Build the user's private reading history that they requested | No |
| User activity | No (no analytics, no clickstream, no telemetry) | — | — | No |
| Website content | No — only the page's URL and title, never page body/content | URL + title sent only to the user's own backend | Identify the saved page in the feed | No |

Notes for the disclosure form:
- The user's configuration (backend URL, write token, feed URL) is stored with `chrome.storage.sync`, which means Chrome transmits it to Google's sync servers to roam across the user's profiles. Declare `chrome.storage.sync` use accordingly.
- The captured URL/title/timestamp leave the device only to reach the backend the user set up. There is no Linktrail-operated collection point.
- Saves that fail transiently (offline / backend unreachable) are parked in `chrome.storage.local` — a device-local, bounded queue (URL + title + timestamp) — and removed once they sync. This is on-device only and is NOT transmitted to Google sync.

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

### Remote Code

**Does this item use remote code?** → **No, I am not using remote code.**

All JavaScript is bundled in the package. There is no `eval`/`new Function`, no
externally-loaded scripts, no `importScripts`, and no CDN/runtime imports (Vite
production build; verified). Network requests (`fetch`) only transfer the user's
own data to/from the backend they configure — they do not load or execute code.
Page favicons displayed in the popup are images, not executable code.

## Privacy Policy

**Privacy Policy URL** [REQUIRED]

https://starfysh-tech.github.io/linktrail/privacy.html

Published via GitHub Pages (`main:/docs`). Verify it loads without a login wall
before submitting. Source of truth: `docs/privacy.html` (and `docs/privacy-policy.md`).

## Distribution

**Visibility**: Unlisted

> Intent: distribute unlisted (shareable by link, not surfaced in store search). v1 is a single-user / personal tool with no accounts.

**Regions**: All regions

### Note on the manifest `key` / extension ID

The extension pins a `key` in `extension/manifest.config.ts` so load-unpacked dev
has a stable extension ID. **The Chrome Web Store rejects an uploaded manifest
that contains `key`** ("key field is not allowed"), so `bun run package` strips
it from the zip automatically — the local `dist/extension` keeps `key` (stable
dev ID), the uploaded zip does not, and the store assigns the published ID.

This means the published extension ID differs from the dev (keyed) ID — which is
fine here: the backend write/read tokens are user-supplied configuration, not
scoped to the extension ID, so saved-history identity does not change between dev
and published builds.

## Developer Info

**Publisher Name** — (fill in: your CWS developer/publisher name)

**Contact Email** — (fill in: a monitored address; displayed publicly on the listing)

**Support URL / Email** — (recommended: the project's GitHub Issues URL, or a support email)

**Homepage URL** — https://starfysh-tech.github.io/linktrail/ (landing page, GitHub Pages; also set as `homepage_url` in the manifest)

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.8.0 | 2026-06-25 | Initial submission: toolbar save, keyboard-shortcut save, private RSS reading history, first-run backend + write-token setup. | Draft |
| 0.8.1 | 2026-06-25 | Add `homepage_url` (landing page); publish landing + privacy policy via GitHub Pages. | Draft |
| 0.9.0 | 2026-06-25 | Popup "already saved on open" hint + `GET /api/status` endpoint. | Draft |
| 0.10.0 | 2026-06-25 | Offline retry queue: temporary failures are parked in `chrome.storage.local` and auto-retried (new `alarms` permission). | Draft |
| 0.11.0 | 2026-06-25 | Optional host access requested at runtime for the user's backend origin, so CORS-less self-hosted backends work (additive; CORS fallback retained). | Draft |
| 0.12.0 | 2026-06-25 | Popup "History" chip opening a private, read-only review web app (search/browse full history) at `/app`, backed by new `GET /api/items`. No new permission. | Draft |

## Review Notes

### Pre-Publish Checklist (tailored to Linktrail)

Manifest & package
- [x] `manifest_version` is 3. (Confirmed in `extension/manifest.config.ts`.)
- [x] Version bumped vs. any prior published version (currently **0.8.1**).
- [x] Manifest `name` is exactly "Linktrail" and matches this listing.
- [x] Manifest `description` ("Capture the current tab into a personal RSS reading history.") is ≤ 132 chars and consistent with the short description above.
- [x] Manifest `key` handled: `bun run package` strips `key` from the zip (the store rejects it); dev load-unpacked keeps it. Published ID is store-assigned (backend tokens aren't ID-scoped, so nothing breaks).
- [x] Built ZIP excludes dev files. `bun run package` zips ONLY `dist/extension` → `dist/linktrail-0.8.1.zip` (no source, `.git`, env, docs, or `CHROMEWEBSTORE.md`).

Permissions
- [x] Manifest requests exactly `["activeTab","storage","notifications","alarms"]` at install — no install-time `host_permissions`, no `<all_urls>`. `optional_host_permissions` (`https://*/*`, `http://localhost/*`) is requested at runtime, narrowed to the single user-entered backend origin.
- [x] Each permission's dashboard justification is filled in from the Permissions Justification table above (plain-English, feature-specific).

Listing content
- [x] Single purpose is the one-sentence statement above (narrow, no marketing language).
- [x] Detailed description names no implementation details beyond "you connect your own backend."
- [x] No misleading claims; every listed feature works in the build you upload (functional pass complete).
- [ ] Contact email is valid and monitored. ← fill in your address.

Privacy & compliance
- [x] Data disclosure form matches the Privacy & Data Use table above.
- [x] `chrome.storage.sync` use is disclosed as off-device transmission.
- [x] Privacy policy URL is live, public, no login wall, and matches the disclosure. (https://starfysh-tech.github.io/linktrail/privacy.html → HTTP 200.)
- [x] No remotely hosted code; all JS is bundled (MV3; Vite build, no runtime CDN scripts).
- [x] Output is minified, not obfuscated (Vite production build).

Functionality (manual pass complete)
- [x] Built extension loads unpacked; popup opens, Save works, the keyboard shortcut saves with a badge, options saves config.
- [x] Failure notification fires when the backend is unreachable.
- [x] Graceful on restricted pages (`chrome://`) — quiet "Can't save this page", no crash.
- [x] A saved page appears newest-first in the feed.

Graphics
- [x] 128×128 store icon ready (`extension/icons/128.png`).
- [x] 1280×800 screenshots created (`store-assets/screenshot-1..3.png`) + a 440×280 promo tile; match the current UI; no real tokens visible.

### Known Issues / Limitations
- v1 is single-user / personal — no multi-user support, no accounts, no sign-in. The listing and single-purpose statement are scoped accordingly.
- The extension depends on a backend the user sets up themselves; with no backend configured, saving cannot succeed (the failure notification is the intended signal).

### Rejection History
<!--
| Date | Reason | Fix Applied | Resubmitted |
|------|--------|-------------|-------------|
-->
