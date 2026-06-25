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
• Private by design — your saved pages go only to a backend you set up and own. There's no shared Linktrail server.
• Settings that follow you — your setup is remembered across the Chrome profiles you sign into, so you only configure it once.
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
• "Notifications" — shows a single message only if a save fails, so you never silently lose a page you meant to keep.

SUPPORT
Questions, bugs, or suggestions? Open an issue on the project's GitHub repository or email the address on this listing.

Version 0.8.0 — Initial release: toolbar save, keyboard-shortcut save, and private RSS reading history.

**Category**

Productivity

**Single Purpose**

Saves the current browser tab's URL and title to the user's own private, RSS-backed reading history.

**Primary Language**

English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ⬜ Not created | (reuse `extension/icons/128.png` or a store-optimized variant) |
| Screenshot 1 [REQUIRED] | 1280×800 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 | ⬜ Not created | |
| Screenshot 3 [RECOMMENDED] | 1280×800 | ⬜ Not created | |
| Screenshot 4 | 1280×800 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | |

### Screenshot Notes

Capture all screenshots at 1280×800 (the larger of the two allowed sizes; more readable in the carousel). Use both light and dark mode so reviewers and users see the system-appearance parity.

1. **Popup — ready to save** (light mode): the toolbar popup open over a real article, showing the page title and the Save button. This is the primary "what you do" shot.
2. **Popup — saved confirmation** (dark mode): the popup or toolbar badge right after a successful save, demonstrating the silent-confirm behavior and dark-mode parity.
3. **Options page — first-run setup**: the options page showing the backend-address and write-token fields, demonstrating "no account, you own the backend." Use placeholder/redacted values — never show a real token.
4. **The feed in an RSS reader**: saved pages newest-first in a generic RSS reader, showing the end payoff. Avoid third-party brand logos/trademarks in the frame where possible.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| activeTab | permissions | Reads the current tab's URL and title only at the moment the user explicitly triggers a save — either clicking the toolbar icon or pressing the keyboard shortcut — so that page can be added to their reading history. The extension has no background or continuous access to tabs and reads nothing until the user acts. |
| storage | permissions | Persists the user's own configuration — their backend URL, write token, and feed URL — using `chrome.storage.sync` so the one-time setup roams across the user's Chrome profiles and does not have to be re-entered on each machine. No browsing data or page content is stored. |
| notifications | permissions | Shows a single notification only when a save fails, so the user is told immediately rather than silently losing a page they intended to keep. It is never used for marketing, promotions, or recurring alerts. |

> No `host_permissions` are requested. Linktrail reaches the user's backend with ordinary network requests; the user's backend is responsible for allowing cross-origin requests (permissive CORS), so no host access needs to be granted to the extension.

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

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED]

Host `docs/privacy-policy.md` at a public, stable URL before submitting (for example, GitHub Pages for this repo or a public gist). Paste that URL here once live, and verify it loads without a login wall.

## Distribution

**Visibility**: Unlisted

> Intent: distribute unlisted (shareable by link, not surfaced in store search). v1 is a single-user / personal tool with no accounts.

**Regions**: All regions

### Note on the manifest `key` / extension ID

The extension currently runs load-unpacked with a pinned `key` in `extension/manifest.config.ts`, which fixes a stable extension ID during development. When you upload to the Chrome Web Store:
- The store assigns/expects its own public key and will derive the published extension ID from it. The dev `key` you pinned will generally NOT match the store-assigned ID.
- Decide deliberately: either keep the dev `key` so the unpacked dev build and the store build can be made to share an ID, or remove it and let the store own the identity. Whichever you choose, confirm the resulting extension ID is the one your backend's write/read tokens are scoped to, so saved-history identity does not silently change between dev and published builds.

## Developer Info

**Publisher Name** — (fill in: your CWS developer/publisher name)

**Contact Email** — (fill in: a monitored address; displayed publicly on the listing)

**Support URL / Email** — (recommended: the project's GitHub Issues URL, or a support email)

**Homepage URL** — (recommended: the project repository or landing page)

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.8.0 | 2026-06-25 | Initial submission: toolbar save, keyboard-shortcut save, private RSS reading history, first-run backend + write-token setup. | Draft |

## Review Notes

### Pre-Publish Checklist (tailored to Linktrail)

Manifest & package
- [ ] `manifest_version` is 3. (Confirmed in `extension/manifest.config.ts`.)
- [ ] Version bumped vs. any prior published version (currently 0.8.0).
- [ ] Manifest `name` is exactly "Linktrail" and matches this listing.
- [ ] Manifest `description` ("Capture the current tab into a personal RSS reading history.") is ≤ 132 chars and consistent with the short description above.
- [ ] Decide on the manifest `key` for the store build (see "Note on the manifest key / extension ID").
- [ ] Built ZIP excludes dev files: `node_modules/`, `.git/`, `.env.local`, source maps, `vite.config.*`, `tsconfig.json`, `package*.json`, `CHROMEWEBSTORE.md`, `README.md`, `docs/`, tests. Ship only the built extension output.

Permissions
- [ ] Manifest requests exactly `["activeTab","storage","notifications"]` — no extras, no `host_permissions`, no `<all_urls>`.
- [ ] Each permission's dashboard justification is filled in from the Permissions Justification table above (plain-English, feature-specific).

Listing content
- [ ] Single purpose is the one-sentence statement above (narrow, no marketing language).
- [ ] Detailed description names no implementation details (no Vite, Neon, Vercel internals, Chrome API names) beyond "you connect your own backend."
- [ ] No misleading claims; every listed feature actually works in the build you upload.
- [ ] Contact email is valid and monitored.

Privacy & compliance
- [ ] Data disclosure form matches the Privacy & Data Use table above (web history = URL/title of saved pages; sent only to the user's backend; no publisher collection; no sale/sharing).
- [ ] `chrome.storage.sync` use is disclosed as off-device transmission (config roams via Google's sync servers).
- [ ] Privacy policy URL is live, public, no login wall, and matches the disclosure.
- [ ] No remotely hosted code; all JS is bundled (MV3-enforced — verify the build loads no runtime CDN scripts).
- [ ] Output is minified, not obfuscated.

Functionality
- [ ] Load the built (not just source) extension unpacked; confirm popup opens, Save works, the keyboard shortcut saves with a badge, and the options page saves config.
- [ ] Verify the failure notification fires when the backend is unreachable (so the notifications permission is demonstrably exercised).
- [ ] Confirm graceful behavior on restricted pages (e.g., `chrome://` URLs) — no crash.
- [ ] Confirm a saved page actually appears newest-first in the feed.

Graphics
- [ ] 128×128 store icon ready.
- [ ] At least one 1280×800 screenshot showing the extension in action (see Screenshot Notes); screenshots match the current UI; no real tokens visible.

### Known Issues / Limitations
- v1 is single-user / personal — no multi-user support, no accounts, no sign-in. The listing and single-purpose statement are scoped accordingly.
- The extension depends on a backend the user sets up themselves; with no backend configured, saving cannot succeed (the failure notification is the intended signal).

### Rejection History
<!--
| Date | Reason | Fix Applied | Resubmitted |
|------|--------|-------------|-------------|
-->
