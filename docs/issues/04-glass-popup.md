# Slice 4 — Glass popup (considered path)

## What to build

The considered capture path: clicking the toolbar icon opens a compact Apple-native
glass popup that shows what's about to be saved and saves it on demand, so the user
can review a page before keeping it.

The popup shows a page card (favicon, title, cleaned-up URL preview), a single
primary Save button, an inline result strip, and secondary links to open the feed
and settings. Visuals follow the design direction: glass material on the popup
shell and status pill only, the `#0A84FF` accent used sparingly, and full light/dark
mode parity. The popup is driven by the shared six-state model (ready, saving,
saved, duplicate, failed, not-capturable) expressed as CSS classes toggled by a
small controller. The popup does not detect "already saved" on open in v1; clicking
Save returns the duplicate outcome if applicable.

## Acceptance criteria

- [ ] Clicking the toolbar icon opens the popup showing favicon, title, and a
      cleaned-up URL preview of the current page.
- [ ] A single primary Save button saves the page and updates an inline result strip
      (saved / already saved / failed).
- [ ] Secondary links open the feed and the settings page.
- [ ] Glass material is applied only to the popup shell and status pill; the accent
      is used sparingly.
- [ ] The popup renders correctly in both light and dark mode.
- [ ] The popup uses the shared six-state model.
- [ ] **Seam 3**: unit tests cover the capture-decision functions (is-capturable,
      payload assembly, response→state mapping) with chrome and fetch mocked.

## Blocked by

- Slice 1 — Capture spine (uses Slice 3's stored config)
