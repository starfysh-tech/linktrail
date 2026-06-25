# Slice 2 — Normalization, dedupe & backend hardening

## What to build

Make the backend correct and trustworthy: identical URL identity on both sides,
real deduplication, input validation, and a sensible title fallback — so re-saving
the same article never produces a second feed item and junk never reaches the
datastore.

The shared normalization module implements the full "moderate" policy and is
imported by both the extension and the backend so they compute identical
identities. The save endpoint uses a unique constraint on the normalized URL plus
an upsert, returning a `saved` or `duplicate` outcome. The endpoint rejects
non-http(s) URLs with a clear 4xx, and falls back to the normalized host as the
title when the provided title is empty. The endpoints return permissive CORS
headers and answer preflight so the extension needs no host permissions.

Moderate normalization: lowercase host; canonicalize scheme to https for the key;
drop `www.`; strip default ports; remove the fragment; drop a trailing slash; strip
known tracking params (`utm_*`, `fbclid`, `gclid`, `ref`, `mc_*`) while preserving
meaningful params (e.g. `?id=`, `?v=`). The original URL is always preserved as the
RSS link target.

## Acceptance criteria

- [ ] The shared normalization module applies the full moderate policy and is
      imported by both extension and backend (no duplicated logic).
- [ ] Re-saving a URL that normalizes to an existing one returns `duplicate` and
      does not create a second row.
- [ ] Tracking parameters are stripped; meaningful query params are preserved.
- [ ] Non-http(s) URLs are rejected server-side with a clear 4xx.
- [ ] An empty/whitespace title is stored as the normalized host.
- [ ] Endpoints return permissive CORS headers and handle preflight.
- [ ] **Seam 1**: backend HTTP integration tests against a test Neon database cover
      auth, validation, normalization+dedupe, host-fallback title, and RSS output.
- [ ] **Seam 2**: unit tests cover the shared normalization function's combinatorial
      cases and idempotency.

## Blocked by

- Slice 1 — Capture spine
