import { describe, it, expect } from "bun:test";
import { verifyResultMessage, originPatternFor } from "../extension/src/options";

describe("verifyResultMessage", () => {
  it("returns a success message on 200 with ok:true", () => {
    const r = verifyResultMessage(200, { ok: true, feedUrl: "https://x/feed" });
    expect(r.ok).toBe(true);
    expect(r.message).toBe("Connected.");
  });

  it("flags the write token on 401", () => {
    const r = verifyResultMessage(401, { ok: false, error: "unauthorized" });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/write token/i);
  });

  it("reports an unreachable backend on network failure (status 0, null body)", () => {
    const r = verifyResultMessage(0, null);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/backend/i);
  });
});

describe("originPatternFor", () => {
  it("builds an origin match pattern from an https backend URL", () => {
    expect(originPatternFor("https://app.vercel.app")).toBe("https://app.vercel.app/*");
  });

  it("ignores any path on the backend URL (origin only)", () => {
    expect(originPatternFor("https://app.vercel.app/api/save")).toBe("https://app.vercel.app/*");
  });

  it("drops the port so the pattern is a valid host pattern (matches any port)", () => {
    expect(originPatternFor("http://localhost:3000")).toBe("http://localhost/*");
  });

  it("returns null for non-http(s) schemes and malformed URLs", () => {
    expect(originPatternFor("ftp://example.com")).toBeNull();
    expect(originPatternFor("chrome://settings")).toBeNull();
    expect(originPatternFor("not a url")).toBeNull();
    expect(originPatternFor("")).toBeNull();
  });
});
