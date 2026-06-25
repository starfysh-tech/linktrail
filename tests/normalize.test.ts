import { describe, it, expect } from "bun:test";
import { normalizeUrl } from "../lib/normalize";

// Slice 1 builds only *basic* normalization: enough to be a stable dedupe key.
// The full "moderate" policy (www. removal, tracking-param stripping) is Slice 2,
// which deepens this same shared module test-first.
describe("normalizeUrl (basic — Slice 1)", () => {
  it("canonicalizes scheme to https and lowercases the host", () => {
    expect(normalizeUrl("HTTP://Example.COM/Path")).toBe("https://example.com/Path");
  });

  it("drops the #fragment", () => {
    expect(normalizeUrl("https://example.com/a#section")).toBe("https://example.com/a");
  });

  it("drops a trailing slash, collapsing the bare root to no path", () => {
    expect(normalizeUrl("https://example.com/a/")).toBe("https://example.com/a");
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com");
  });

  it("drops default ports", () => {
    expect(normalizeUrl("http://example.com:80/a")).toBe("https://example.com/a");
    expect(normalizeUrl("https://example.com:443/a")).toBe("https://example.com/a");
  });

  it("preserves the query string (tracking-param stripping is Slice 2)", () => {
    expect(normalizeUrl("https://example.com/watch?v=abc&utm_source=x")).toBe(
      "https://example.com/watch?v=abc&utm_source=x",
    );
  });

  it("is idempotent — normalizing a normalized URL is a no-op", () => {
    const once = normalizeUrl("HTTP://Example.com:80/a/#x");
    expect(normalizeUrl(once)).toBe(once);
  });
});
