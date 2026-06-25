import { describe, it, expect } from "bun:test";
import { normalizeUrl } from "../lib/normalize";

// Full "moderate" normalization (Slice 2): the shared dedupe-identity policy
// imported by both extension and backend.
describe("normalizeUrl — structural (scheme/host/path)", () => {
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

  it("drops a leading www.", () => {
    expect(normalizeUrl("https://www.example.com/a")).toBe("https://example.com/a");
    // only an exact leading "www." — not "www2" or a mid-host "www."
    expect(normalizeUrl("https://www2.example.com/a")).toBe("https://www2.example.com/a");
  });
});

describe("normalizeUrl — query params", () => {
  it("strips utm_* tracking params", () => {
    expect(normalizeUrl("https://example.com/a?utm_source=x&utm_medium=y")).toBe(
      "https://example.com/a",
    );
  });

  it("strips fbclid, gclid, ref, and mc_* params", () => {
    expect(normalizeUrl("https://example.com/a?fbclid=1&gclid=2&ref=3&mc_cid=4")).toBe(
      "https://example.com/a",
    );
  });

  it("preserves meaningful params while stripping tracking ones", () => {
    expect(normalizeUrl("https://example.com/watch?v=abc&utm_source=x")).toBe(
      "https://example.com/watch?v=abc",
    );
    expect(normalizeUrl("https://example.com/item?id=42&fbclid=zz")).toBe(
      "https://example.com/item?id=42",
    );
  });

  it("preserves the order of kept params", () => {
    expect(normalizeUrl("https://example.com/a?b=2&utm_x=1&a=1")).toBe(
      "https://example.com/a?b=2&a=1",
    );
  });
});

describe("normalizeUrl — idempotency", () => {
  it("normalizing a normalized URL is a no-op", () => {
    const once = normalizeUrl("HTTP://www.Example.com:80/a/?v=1&utm_source=x#frag");
    expect(normalizeUrl(once)).toBe(once);
  });
});
