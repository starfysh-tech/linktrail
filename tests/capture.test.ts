import { describe, it, expect } from "bun:test";
import {
  isCapturable,
  buildPayload,
  mapResponseToState,
  previewUrl,
  resultText,
} from "../extension/src/capture";

describe("isCapturable", () => {
  it("is true for http and https pages", () => {
    expect(isCapturable("http://example.com")).toBe(true);
    expect(isCapturable("https://example.com/path?q=1")).toBe(true);
  });

  it("is false for browser-internal and non-web schemes", () => {
    expect(isCapturable("chrome://extensions")).toBe(false);
    expect(isCapturable("chrome-extension://abc/page.html")).toBe(false);
    expect(isCapturable("about:blank")).toBe(false);
    expect(isCapturable("file:///Users/me/notes.txt")).toBe(false);
    expect(isCapturable("view-source:https://example.com")).toBe(false);
    expect(isCapturable("data:text/html,<h1>hi</h1>")).toBe(false);
  });

  it("is false for undefined and malformed URLs", () => {
    expect(isCapturable(undefined)).toBe(false);
    expect(isCapturable("")).toBe(false);
    expect(isCapturable("not a url")).toBe(false);
  });
});

describe("buildPayload", () => {
  it("fills an empty title when none is provided", () => {
    expect(buildPayload({ url: "https://example.com" })).toEqual({
      url: "https://example.com",
      title: "",
    });
  });

  it("preserves a provided title", () => {
    expect(buildPayload({ url: "https://example.com", title: "Hello" })).toEqual({
      url: "https://example.com",
      title: "Hello",
    });
  });
});

describe("mapResponseToState", () => {
  it("maps 200 to saved", () => {
    expect(mapResponseToState(200)).toBe("saved");
    expect(mapResponseToState(200, "saved")).toBe("saved");
  });

  it("maps 200 + duplicate outcome to duplicate", () => {
    expect(mapResponseToState(200, "duplicate")).toBe("duplicate");
  });

  it("maps 4xx and 5xx to failed", () => {
    expect(mapResponseToState(404)).toBe("failed");
    expect(mapResponseToState(401)).toBe("failed");
    expect(mapResponseToState(503)).toBe("failed");
    expect(mapResponseToState(500)).toBe("failed");
  });
});

describe("previewUrl", () => {
  it("drops the scheme and applies shared normalization (www./tracking)", () => {
    expect(previewUrl("https://www.example.com/a/?utm_source=x")).toBe("example.com/a");
    expect(previewUrl("http://Example.com/Path?id=7")).toBe("example.com/Path?id=7");
  });

  it("returns the input unchanged when it cannot be parsed", () => {
    expect(previewUrl("not a url")).toBe("not a url");
  });
});

describe("resultText", () => {
  it("gives a distinct string per terminal state and is empty for ready", () => {
    expect(resultText("ready")).toBe("");
    expect(resultText("saved")).toBe("Saved");
    expect(resultText("duplicate")).toBe("Already saved");
    expect(resultText("not-capturable")).toBe("Can’t save this page");
    expect(resultText("failed")).not.toBe("");
  });
});
