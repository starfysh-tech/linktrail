import { describe, it, expect } from "bun:test";
import { parseHTML } from "linkedom";
import {
  extractMarkdown,
  markdownFilename,
  frontMatter,
  markdownDocument,
  type HtmlToDocument,
} from "../extension/src/extract";

// linkedom stands in for the popup's real DOMParser: the seam stays DOM-free and
// the caller injects the parser. Cast to Document — linkedom is structurally
// Readability-compatible but not nominally the lib.dom type.
const toDom: HtmlToDocument = (html) => parseHTML(html).document as unknown as Document;

/** A page with enough prose for Readability to treat the <article> as content. */
const articleHtml = `<!doctype html>
<html><head><title>The Tide Pools of Point Lobos</title></head>
<body>
  <header><nav>Home · About</nav></header>
  <article>
    <h1>The Tide Pools of Point Lobos</h1>
    <p>The tide pools at Point Lobos hold a <strong>quiet</strong> abundance of life
       that rewards a slow, patient look. Anemones, hermit crabs, and the occasional
       sculpin shelter in the cold shallows between the granite. Lorem ipsum dolor sit
       amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.</p>
    <p>Arrive an hour before low tide so the water has time to fall and expose the
       lower shelves. The richest pools sit just below the mean-low line, where the
       sea only briefly retreats and the residents are accustomed to constant cover.</p>
    <ul><li>Anemones</li><li>Hermit crabs</li></ul>
  </article>
  <footer>© Tidewatch</footer>
</body></html>`;

describe("extractMarkdown", () => {
  it("isolates the article and converts it to Markdown", () => {
    const r = extractMarkdown(articleHtml, "https://tidewatch.example/point-lobos", "Tab Title", toDom);
    expect(r.ok).toBe(true);
    expect(r.title).toBe("The Tide Pools of Point Lobos");
    // Emphasis survives the conversion, the list uses "-" bullets, and the
    // surrounding nav/footer chrome has been stripped by Readability.
    expect(r.markdown).toContain("**quiet**");
    expect(r.markdown).toContain("-   Anemones");
    expect(r.markdown).not.toContain("Home · About");
    expect(r.markdown).not.toContain("Tidewatch");
  });

  it("returns ok:false (no garbage) for an un-hydrated SPA shell", () => {
    const spa = `<!doctype html><html><head><title>Dashboard</title></head>
      <body><div id="root"></div><script src="/app.js"></script></body></html>`;
    const r = extractMarkdown(spa, "https://app.example/dashboard", "Dashboard", toDom);
    expect(r.ok).toBe(false);
    expect(r.markdown).toBe("");
    // Title still falls back so the caller has something to label the failure with.
    expect(r.title).toBe("Dashboard");
  });

  it("falls back to the tab title, then the URL host, when the article has none", () => {
    const r = extractMarkdown("<html><body></body></html>", "https://only-host.example/x", "", toDom);
    expect(r.ok).toBe(false);
    expect(r.title).toBe("only-host.example");
  });
});

describe("markdownFilename", () => {
  it("slugs the title to a portable .md name", () => {
    expect(markdownFilename("The Tide Pools of Point Lobos!", "https://x.example")).toBe(
      "the-tide-pools-of-point-lobos.md",
    );
  });

  it("falls back to the URL host+path when there is no title", () => {
    expect(markdownFilename("", "https://blog.example/2026/06/hi")).toBe(
      "blog-example-2026-06-hi.md",
    );
  });

  it("falls back to a constant when neither title nor URL yields a slug", () => {
    expect(markdownFilename("", "not a url")).toBe("page.md");
    expect(markdownFilename("***", "::::")).toBe("page.md");
  });
});

describe("frontMatter / markdownDocument", () => {
  it("emits a YAML block with the capture metadata", () => {
    const fm = frontMatter({
      title: "Hello",
      url: "https://x.example/a",
      capturedAt: "2026-06-28T12:00:00.000Z",
    });
    expect(fm).toBe(
      [
        "---",
        'title: "Hello"',
        "url: https://x.example/a",
        "captured: 2026-06-28T12:00:00.000Z",
        "---",
      ].join("\n"),
    );
  });

  it("escapes double quotes and backslashes in the title", () => {
    const fm = frontMatter({
      title: 'A "quoted" \\ title',
      url: "https://x.example",
      capturedAt: "2026-06-28T12:00:00.000Z",
    });
    expect(fm).toContain('title: "A \\"quoted\\" \\\\ title"');
  });

  it("composes front-matter above the article markdown", () => {
    const doc = markdownDocument(
      { title: "Hi", url: "https://x.example", capturedAt: "2026-06-28T12:00:00.000Z" },
      "# Body\n\nText.",
    );
    expect(doc.startsWith("---\n")).toBe(true);
    expect(doc).toContain("\n\n# Body\n\nText.\n");
  });
});
