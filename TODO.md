# TODO

Outstanding work and known limitations. Not a roadmap — just an honest list of
what's open. See `CHANGELOG.md` for what's shipped.

## Chrome Web Store (pre-publish)
- [ ] Justify the new **`scripting`** permission in the store listing — it's used
      only at save/export, on the user's gesture, to read the rendered page so it
      can be archived as Markdown (no background use). See `CHROMEWEBSTORE.md`.
- [ ] Refresh the disclosure form: **Website content = Yes** now (page content is
      read and archived to the user's own backend).
- [ ] Update/extend screenshots + promo assets to show the review app's new
      features (content search, rendered preview, `.md` download, delete).
- [ ] Re-package (`bun run package`) at the current version and re-verify the
      pre-publish checklist.

## Self-hosting / deploy
- [ ] Self-hosters must **redeploy** their backend to get refresh-on-save and the
      `DELETE` endpoint — both are backend changes that don't ride with the
      extension version.

## Extraction quality
- [ ] **Interactive widgets still can't round-trip** to static Markdown (skill
      trees, variant selectors, anything built from `div`+icon with no semantic
      structure). The cleanup makes the writeup + real tables clean; faithful
      capture of interactive components is out of scope for the client-side
      Readability/Turndown path (would need remote/LLM extraction).
- [ ] The archived-Markdown size guard is a flat constant (`GZ_BASE64_CAP`); the
      gzip "headroom" is generous, but there's no measured/tuned cap. Revisit only
      if real pages start getting skipped.

## Manual verification (no headless coverage)
- [ ] Popup **Save** and the **keyboard-command** save archive a heavy real page
      end-to-end (the in-page separator pass + `linkedom`/Readability in the live
      MV3 service worker).
- [ ] Preview modal renders content-rich Markdown (tables/code/images) and a
      `mermaid` diagram correctly.
- [ ] Delete flow: click-to-confirm, write-token prompt on first delete, row drops
      and list repaints.
