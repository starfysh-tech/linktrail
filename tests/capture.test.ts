import { describe, it, expect } from "bun:test";
import {
  isCapturable,
  buildPayload,
  mapResponseToState,
  previewUrl,
  resultText,
  failureKind,
  failureText,
  badgeFor,
  badgeAutoClears,
  failureNotification,
  shouldShowSavedHint,
  savedHintText,
  reviewUrlFrom,
  shouldEnqueue,
  enqueueItem,
  flushDisposition,
  queuedNotification,
  flushedNotification,
  QUEUE_MAX,
  type QueuedCapture,
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

describe("failureKind / failureText", () => {
  it("classifies 4xx as config and 5xx/network as temporary", () => {
    expect(failureKind(401)).toBe("config");
    expect(failureKind(404)).toBe("config");
    expect(failureKind(500)).toBe("temporary");
    expect(failureKind(503)).toBe("temporary");
    expect(failureKind(0)).toBe("temporary"); // network error sentinel
  });

  it("routes config failures to settings and temporary failures to retry", () => {
    expect(failureText("config")).toBe("Check settings");
    expect(failureText("temporary")).toContain("try again");
  });
});

describe("badgeFor / badgeAutoClears", () => {
  it("gives a tick for success/duplicate, cross for failed, dash for not-capturable", () => {
    expect(badgeFor("saved").text).toBe("✓");
    expect(badgeFor("duplicate").text).toBe("✓");
    expect(badgeFor("failed").text).toBe("✗");
    expect(badgeFor("not-capturable").text).toBe("—");
    expect(badgeFor("ready").text).toBe("");
  });

  it("auto-clears success/duplicate/not-capturable but persists failures", () => {
    expect(badgeAutoClears("saved")).toBe(true);
    expect(badgeAutoClears("duplicate")).toBe(true);
    expect(badgeAutoClears("not-capturable")).toBe(true);
    expect(badgeAutoClears("failed")).toBe(false);
  });
});

describe("shouldShowSavedHint", () => {
  it("shows the hint only for a 200 with saved: true", () => {
    expect(shouldShowSavedHint(200, { saved: true })).toBe(true);
  });

  it("hides the hint for a 200 reporting not saved", () => {
    expect(shouldShowSavedHint(200, { saved: false })).toBe(false);
  });

  it("hides the hint on any error status, regardless of body", () => {
    expect(shouldShowSavedHint(401, { saved: true })).toBe(false);
    expect(shouldShowSavedHint(503, { saved: true })).toBe(false);
    expect(shouldShowSavedHint(0)).toBe(false); // network-error sentinel
  });

  it("hides the hint when the body is missing or malformed", () => {
    expect(shouldShowSavedHint(200)).toBe(false);
    expect(shouldShowSavedHint(200, {})).toBe(false);
  });
});

describe("savedHintText", () => {
  it("is a non-empty hint about the page already being saved", () => {
    expect(savedHintText().toLowerCase()).toContain("trail");
  });
});

describe("reviewUrlFrom", () => {
  it("builds an /app/ deep link carrying the read token from the feed URL", () => {
    const url = reviewUrlFrom(
      "https://linktrail-alpha.vercel.app",
      "https://linktrail-alpha.vercel.app/api/feed?token=READ123",
    );
    expect(url).toBe("https://linktrail-alpha.vercel.app/app/?token=READ123");
  });

  it("trims a trailing slash on the backend URL", () => {
    expect(reviewUrlFrom("https://x.com/", "https://x.com/api/feed?token=t")).toBe(
      "https://x.com/app/?token=t",
    );
  });

  it("returns null when backend, feed, or token is missing", () => {
    expect(reviewUrlFrom(undefined, "https://x/api/feed?token=t")).toBeNull();
    expect(reviewUrlFrom("https://x", undefined)).toBeNull();
    expect(reviewUrlFrom("https://x", "https://x/api/feed")).toBeNull();
  });
});

describe("shouldEnqueue", () => {
  it("queues temporary failures (5xx / network sentinel)", () => {
    expect(shouldEnqueue(500)).toBe(true);
    expect(shouldEnqueue(503)).toBe(true);
    expect(shouldEnqueue(0)).toBe(true);
  });

  it("does NOT queue config failures (4xx)", () => {
    expect(shouldEnqueue(401)).toBe(false);
    expect(shouldEnqueue(400)).toBe(false);
    expect(shouldEnqueue(404)).toBe(false);
  });
});

describe("enqueueItem", () => {
  const mk = (url: string, queuedAt = 1): QueuedCapture => ({ url, title: "t", queuedAt });

  it("appends a new capture as most-recent", () => {
    const q = enqueueItem([mk("https://a.com")], mk("https://b.com", 2));
    expect(q.map((i) => i.url)).toEqual(["https://a.com", "https://b.com"]);
  });

  it("dedupes by normalized identity, keeping the newer entry at the end", () => {
    const q = enqueueItem(
      [mk("https://www.a.com/?utm_source=x", 1), mk("https://b.com", 2)],
      mk("https://a.com", 3),
    );
    // The www./tracking variant collapses to the same identity as a.com.
    expect(q.map((i) => i.url)).toEqual(["https://b.com", "https://a.com"]);
    expect(q[q.length - 1].queuedAt).toBe(3);
  });

  it("caps the queue by evicting the oldest", () => {
    const seed = Array.from({ length: QUEUE_MAX }, (_, i) => mk(`https://e.com/${i}`, i));
    const q = enqueueItem(seed, mk("https://e.com/new", 999));
    expect(q.length).toBe(QUEUE_MAX);
    expect(q[0].url).toBe("https://e.com/1"); // /0 evicted
    expect(q[q.length - 1].url).toBe("https://e.com/new");
  });
});

describe("flushDisposition", () => {
  it("removes items that saved (200) or are permanently invalid (400)", () => {
    expect(flushDisposition(200)).toBe("remove");
    expect(flushDisposition(400)).toBe("remove");
  });

  it("keeps items on transient/fixable statuses (auth, 5xx, network)", () => {
    expect(flushDisposition(401)).toBe("keep");
    expect(flushDisposition(503)).toBe("keep");
    expect(flushDisposition(0)).toBe("keep");
  });
});

describe("queued badge & copy", () => {
  it("gives the queued state an amber hourglass badge that auto-clears", () => {
    expect(badgeFor("queued").text).toBe("⏳");
    expect(badgeAutoClears("queued")).toBe(true);
  });

  it("reads 'Queued — will retry' in the result strip", () => {
    expect(resultText("queued")).toContain("Queued");
  });
});

describe("queued / flushed notifications", () => {
  it("queued notification reassures the page will sync later", () => {
    expect(queuedNotification().message.toLowerCase()).toContain("sync");
  });

  it("flushed notification pluralizes the synced count", () => {
    expect(flushedNotification(1).message).toContain("1 queued page ");
    expect(flushedNotification(3).message).toContain("3 queued pages ");
  });
});

describe("failureNotification", () => {
  it("only differs by kind and steers config failures toward settings", () => {
    expect(failureNotification("config").title.toLowerCase()).toContain("settings");
    expect(failureNotification("temporary").message.toLowerCase()).toContain("retry");
  });
});
