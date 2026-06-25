import { describe, it, expect } from "bun:test";
import { verifyResultMessage } from "../extension/src/options";

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
