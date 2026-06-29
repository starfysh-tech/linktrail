/**
 * The in-page DOM reader injected via `chrome.scripting.executeScript`. It runs
 * in the *page's* context (not the extension's), so it has the live layout —
 * `getComputedStyle` works here but NOT in the pure `extract.ts` seam, which only
 * ever sees a re-parsed HTML string with no layout.
 *
 * Its one job beyond returning the HTML: a "separator pass". App-style pages
 * (build guides, dashboards) render distinct values as adjacent inline elements
 * with no whitespace between them, so a naive `outerHTML` → Turndown fuses them
 * ("Chest armor" + "Wyward's Aspect" → "Chest armorWyward's Aspect"). Here we
 * append a single space after every block/flex/grid/list-item/table element whose
 * text doesn't already end in whitespace, so those values stay separated once the
 * layout is gone. We work on a CLONE so the live page is never mutated.
 *
 * Self-contained on purpose: executeScript serializes this function's source and
 * runs it detached, so it may reference only page globals (no imports/closures).
 */
export function readEnrichedHtml(): string {
  const root = document.documentElement;
  if (!document.body) return root.outerHTML;

  const live = Array.from(document.body.querySelectorAll<HTMLElement>("*"));
  const clonedRoot = root.cloneNode(true) as HTMLElement;
  const clonedBody = clonedRoot.querySelector("body");
  if (!clonedBody) return clonedRoot.outerHTML;

  const cloned = Array.from(clonedBody.querySelectorAll<HTMLElement>("*"));
  // querySelectorAll yields document order on both, so indices line up.
  const n = Math.min(live.length, cloned.length);
  const BLOCKISH = /block|flex|grid|list-item|table/;
  for (let i = 0; i < n; i++) {
    const display = getComputedStyle(live[i]).display;
    if (!BLOCKISH.test(display)) continue;
    const text = cloned[i].textContent;
    if (text && !/\s$/.test(text)) {
      cloned[i].appendChild(document.createTextNode(" "));
    }
  }
  return clonedRoot.outerHTML;
}
