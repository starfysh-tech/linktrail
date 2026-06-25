import { describe, it, expect } from "bun:test";
import {
  parseToken,
  authState,
  filterItems,
  sortItems,
  presetSince,
  filterByDate,
  domainOf,
  relativeTime,
  type DatePreset,
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

describe("filterItems", () => {
  const items = [
    mk({ id: "1", title: "Prompt caching docs", url: "https://platform.claude.com/x" }),
    mk({ id: "2", title: "PostgreSQL tips", url: "https://neon.tech/y" }),
  ];
  it("matches title or URL, case-insensitively", () => {
    expect(filterItems(items, "claude").map((i) => i.id)).toEqual(["1"]);
    expect(filterItems(items, "NEON").map((i) => i.id)).toEqual(["2"]);
    expect(filterItems(items, "p").map((i) => i.id)).toEqual(["1", "2"]);
  });
  it("returns everything for an empty query", () => {
    expect(filterItems(items, "   ")).toHaveLength(2);
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

describe("relativeTime", () => {
  const now = Date.parse("2026-06-25T12:00:00.000Z");
  it("renders compact buckets under a week", () => {
    expect(relativeTime("2026-06-25T11:59:30.000Z", now)).toBe("just now");
    expect(relativeTime("2026-06-25T11:30:00.000Z", now)).toBe("30m ago");
    expect(relativeTime("2026-06-25T09:00:00.000Z", now)).toBe("3h ago");
    expect(relativeTime("2026-06-23T12:00:00.000Z", now)).toBe("2d ago");
  });
});
