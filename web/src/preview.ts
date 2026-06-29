/**
 * Markdown preview renderer — lazy-loaded (imported only when a user opens a
 * preview) so marked/DOMPurify/Mermaid never weigh on the base bundle. Mermaid
 * is further dynamic-imported, and only when a diagram is actually present.
 *
 * Security: the Markdown is captured from arbitrary third-party pages, so its
 * rendered HTML is untrusted. We render with marked, then DOMPurify-sanitize the
 * result before it ever touches innerHTML (the rest of the app uses textContent;
 * this is the one deliberate HTML path). Mermaid runs AFTER sanitize, with
 * securityLevel:"strict", over diagram source we emitted ourselves — no added
 * injection surface.
 */
import { Marked } from "marked";
import DOMPurify from "dompurify";
import { hasMermaid } from "./view";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// A scoped marked instance (no global mutation). Fenced ```mermaid blocks become
// <pre class="mermaid"> holding the raw (escaped) source for Mermaid to pick up;
// every other code block falls through to marked's default renderer.
const md = new Marked({ gfm: true });
md.use({
  renderer: {
    code(token) {
      if ((token.lang ?? "").trim().toLowerCase() === "mermaid") {
        return `<pre class="mermaid">${escapeHtml(token.text)}</pre>`;
      }
      return false; // fall back to the default code renderer
    },
  },
});

/**
 * Render `markdown` into `container` (replacing its contents). Resolves once the
 * sanitized HTML is in place; any Mermaid diagrams render asynchronously after.
 */
export async function renderMarkdownInto(
  container: HTMLElement,
  markdown: string,
): Promise<void> {
  const rawHtml = md.parse(markdown) as string;
  container.innerHTML = DOMPurify.sanitize(rawHtml);

  // Saved-page links should open in a new tab, safely.
  for (const a of container.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }

  if (hasMermaid(markdown)) {
    try {
      const { default: mermaid } = await import("mermaid");
      const light = window.matchMedia("(prefers-color-scheme: light)").matches;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: light ? "default" : "dark",
      });
      await mermaid.run({
        nodes: [...container.querySelectorAll<HTMLElement>("pre.mermaid")],
      });
    } catch {
      // Engine failed to load or a diagram failed to parse — leave the source
      // visible as a code block rather than breaking the whole preview.
    }
  }
}
