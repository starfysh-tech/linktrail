# Privacy Policy for Linktrail

Last updated: 2026-06-29

Linktrail is a Chrome extension that saves pages you choose into your own private,
RSS-based reading history. This policy explains exactly what information Linktrail
handles and where it goes. In plain terms: Linktrail's publisher does not run a
server, does not collect your data, and never sees what you save. Everything you
save goes only to a backend that you set up and control.

## What Data We Collect

When — and only when — you explicitly save a page (by clicking the Linktrail
toolbar icon or pressing the keyboard shortcut), Linktrail reads from the current
tab:

- The page's address (URL)
- The page's title
- The time you saved it (timestamp)
- A cleaned **Markdown copy of the page's main content**, so you can read,
  search, and download what you saved later

To make that Markdown copy, Linktrail reads the rendered content of the page —
but only at the moment you explicitly save (or use the "Export as Markdown"
action). It does not track your browsing and does not run in the background
watching your tabs: it reads nothing until you take an explicit action.

Linktrail also stores your own configuration so you don't have to re-enter it:

- Your backend address
- Your write token (used to authorize saves to your backend)
- Your private feed address (which contains a separate read token)

This configuration is information you provide during setup — it is not collected
from your browsing.

## How Data Is Stored

- Your saved pages (URL, title, timestamp, and the Markdown copy of the page) are
  sent to the backend **you** set up and own. Linktrail's publisher operates no
  shared server and stores none of this.
- Your configuration (backend address, write token, feed address) is stored using
  Chrome's synced storage (`chrome.storage.sync`). This means Chrome transmits that
  configuration to Google's sync servers so it can follow you across the Chrome
  profiles you are signed into. Your saved pages are **not** stored this way — only
  your setup is.

## How Data Is Used

- The page URL, title, timestamp, and Markdown copy are used to build your private
  reading history on your backend, which you then read as an RSS feed and browse,
  search, preview, download, or delete in your private review web app.
- Your write token is used to authorize saving to your backend. Your feed address
  (with its read token) is used to fetch your feed.
- That is the extension's only purpose. There is no analytics, telemetry,
  advertising, or profiling of any kind.

## Third-Party Services

Linktrail does not use any analytics, advertising, or tracking services.

Linktrail sends your saved pages to a backend **you** configure and operate. That
backend is under your control, and any data practices there are governed by how you
set it up — not by Linktrail's publisher.

Chrome's synced storage relies on Google's sync infrastructure to roam your
configuration across your Chrome profiles, which is governed by Google's own privacy
terms.

## Data Sharing

Linktrail's publisher does not sell, rent, or share your data with anyone. The
publisher does not receive your data in the first place — your saved pages go
directly to your own backend.

## Data Retention and Deletion

- Linktrail's publisher retains nothing, because it collects nothing.
- Your saved pages live on your own backend; you control how long they are kept and
  can delete them there at any time.
- To remove your stored configuration, clear it on Linktrail's options page or
  uninstall the extension. Uninstalling removes Linktrail's stored configuration
  from Chrome; because it is synced, removal propagates to your other signed-in
  Chrome profiles.

## Changes to This Policy

If Linktrail's data practices change, this policy will be updated and the "Last
updated" date above will be revised. Material changes will be reflected here before
they take effect in a published version of the extension.

## Contact

For privacy questions, open an issue on the Linktrail project's GitHub repository or
email the contact address listed on the Chrome Web Store listing.
