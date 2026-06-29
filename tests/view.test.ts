import { describe, it, expect } from "bun:test";
import {
  parseToken,
  authState,
  itemsSearchUrl,
  sortItems,
  presetSince,
  filterByDate,
  domainOf,
  markdownDownloadUrl,
  hasMermaid,
  relativeTime,
  toJsonExport,
  toBookmarkHtml,
  toOpml,
  type DatePreset,
  type ExportFile,
} from "../web/src/view";
import type { Item } from "../lib/contract";

const mk = (over: Partial<Item> = {}): Item => ({
  id: "1",
  url: "https://example.com/a",
  title: "Example A",
  capturedAt: "2026-06-25T12:00:00.000Z",
  ...over,
});

describe("parseToken", () => {
  it("extracts the token query param", () => {
    expect(parseToken("https://x/app/?token=abc123")).toBe("abc123");
  });
  it("returns null when absent or unparseable", () => {
    expect(parseToken("https://x/app/")).toBeNull();
    expect(parseToken("not a url")).toBeNull();
  });
});

describe("authState", () => {
  it("is ready with a token, gate without", () => {
    expect(authState("abc")).toBe("ready");
    expect(authState(null)).toBe("gate");
    expect(authState("")).toBe("gate");
  });
});

describe("itemsSearchUrl", () => {
  it("builds the search URL with the query and token encoded", () => {
    expect(itemsSearchUrl("claude docs", "tok&1")).toBe(
      "/api/items?token=tok%261&q=claude%20docs",
    );
  });
  it("trims the query before building", () => {
    expect(itemsSearchUrl("  neon  ", "t")).toBe("/api/items?token=t&q=neon");
  });
  it("returns null for an empty/whitespace query (no round-trip)", () => {
    expect(itemsSearchUrl("", "t")).toBeNull();
    expect(itemsSearchUrl("   ", "t")).toBeNull();
  });
});

describe("sortItems", () => {
  it("orders newest-first without mutating the input", () => {
    const input = [
      mk({ id: "old", capturedAt: "2026-06-01T00:00:00.000Z" }),
      mk({ id: "new", capturedAt: "2026-06-20T00:00:00.000Z" }),
    ];
    expect(sortItems(input).map((i) => i.id)).toEqual(["new", "old"]);
    expect(input[0].id).toBe("old"); // original order preserved
  });
});

describe("presetSince / filterByDate", () => {
  // Fixed "now": 2026-06-25T12:00:00Z.
  const now = Date.parse("2026-06-25T12:00:00.000Z");

  it("'all' applies no lower bound", () => {
    expect(presetSince("all", now)).toBe(0);
  });

  it("'week' keeps only the last 7 days", () => {
    const items = [
      mk({ id: "recent", capturedAt: "2026-06-22T00:00:00.000Z" }),
      mk({ id: "stale", capturedAt: "2026-06-10T00:00:00.000Z" }),
    ];
    expect(filterByDate(items, "week", now).map((i) => i.id)).toEqual(["recent"]);
  });

  it("each preset is monotonically more recent (all <= month <= week <= today)", () => {
    const presets: DatePreset[] = ["all", "month", "week", "today"];
    const bounds = presets.map((p) => presetSince(p, now));
    for (let i = 1; i < bounds.length; i++) {
      expect(bounds[i]).toBeGreaterThanOrEqual(bounds[i - 1]);
    }
  });
});

describe("domainOf", () => {
  it("drops scheme and leading www.", () => {
    expect(domainOf("https://www.example.com/path")).toBe("example.com");
    expect(domainOf("http://neon.tech")).toBe("neon.tech");
  });
  it("falls back to raw input when unparseable", () => {
    expect(domainOf("not a url")).toBe("not a url");
  });
});

describe("hasMermaid", () => {
  it("detects a fenced mermaid block (backticks or tildes, case-insensitive, indented)", () => {
    expect(hasMermaid("# Hi\n\n```mermaid\ngraph TD; A-->B\n```\n")).toBe(true);
    expect(hasMermaid("~~~Mermaid\nsequenceDiagram\n~~~")).toBe(true);
    expect(hasMermaid("text\n  ```mermaid\nflowchart LR\n```")).toBe(true);
  });
  it("is false for plain markdown and non-mermaid fences", () => {
    expect(hasMermaid("# Title\n\n```js\nconst a = 1;\n```")).toBe(false);
    expect(hasMermaid("just prose mentioning mermaid inline")).toBe(false);
  });
});

describe("markdownDownloadUrl", () => {
  it("builds a tokenized .md endpoint URL when the item has an archive", () => {
    const url = markdownDownloadUrl(mk({ id: "42", hasMarkdown: true }), "READ1");
    expect(url).toBe("/api/items?id=42&format=md&token=READ1");
  });

  it("gates the affordance off when the item has no archived markdown", () => {
    expect(markdownDownloadUrl(mk({ id: "1", hasMarkdown: false }), "READ1")).toBeNull();
    expect(markdownDownloadUrl(mk({ id: "1" }), "READ1")).toBeNull(); // flag absent
  });

  it("url-encodes the id and token", () => {
    const url = markdownDownloadUrl(mk({ id: "a/b", hasMarkdown: true }), "t k+");
    expect(url).toBe("/api/items?id=a%2Fb&format=md&token=t%20k%2B");
  });
});

describe("export serializers", () => {
  const items = [
    mk({ id: "1", url: "https://a.com/x", title: "A & B <tag>", capturedAt: "2026-06-20T00:00:00.000Z" }),
    mk({ id: "2", url: "https://b.com/y", title: "Plain", capturedAt: "2026-06-21T00:00:00.000Z" }),
  ];

  it("toJsonExport produces a versioned, re-importable envelope", () => {
    const parsed = JSON.parse(toJsonExport(items, "2026-06-25T12:00:00.000Z")) as ExportFile;
    expect(parsed.linktrail).toBe(1);
    expect(parsed.exportedAt).toBe("2026-06-25T12:00:00.000Z");
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]).toEqual({
      url: "https://a.com/x",
      title: "A & B <tag>",
      capturedAt: "2026-06-20T00:00:00.000Z",
    });
  });

  it("toBookmarkHtml emits a Netscape file with escaped titles and ADD_DATE", () => {
    const html = toBookmarkHtml(items);
    expect(html.startsWith("<!DOCTYPE NETSCAPE-Bookmark-file-1>")).toBe(true);
    // Title is HTML-escaped; URL present; ADD_DATE is unix seconds.
    const addDate = Math.floor(Date.parse("2026-06-20T00:00:00.000Z") / 1000);
    expect(html).toContain(`<A HREF="https://a.com/x" ADD_DATE="${addDate}">A &amp; B &lt;tag&gt;</A>`);
  });

  it("toOpml emits type=link outlines with escaped attributes", () => {
    const opml = toOpml(items);
    expect(opml).toContain('<opml version="2.0">');
    expect(opml).toContain('<outline text="A &amp; B &lt;tag&gt;" type="link" url="https://a.com/x"/>');
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-06-25T12:00:00.000Z");
  it("renders compact buckets under a week", () => {
    expect(relativeTime("2026-06-25T11:59:30.000Z", now)).toBe("just now");
    expect(relativeTime("2026-06-25T11:30:00.000Z", now)).toBe("30m ago");
    expect(relativeTime("2026-06-25T09:00:00.000Z", now)).toBe("3h ago");
    expect(relativeTime("2026-06-23T12:00:00.000Z", now)).toBe("2d ago");
  });
});
