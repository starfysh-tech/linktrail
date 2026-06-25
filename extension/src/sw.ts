/**
 * MV3 service worker — Slice 1 flow: keyboard shortcut → silent save → minimal
 * badge feedback. The full six-state feedback (notifications, distinct 4xx/5xx
 * routing) is Slice 5; here we only need a success tick, a failure cross, and a
 * quiet skip for non-capturable pages.
 */
import { isCapturable, buildPayload, mapResponseToState } from "./capture";

// Apple accent green-ish / red for the two terminal states; neutral grey for skips.
const COLOR_OK = "#34C759";
const COLOR_FAIL = "#FF3B30";
const COLOR_NEUTRAL = "#8E8E93";
const BADGE_CLEAR_MS = 2000;

function setBadge(text: string, color: string): void {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

function clearBadgeSoon(): void {
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), BADGE_CLEAR_MS);
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture-current-tab") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Browser-internal / non-web pages: skip the backend entirely with a quiet hint.
  if (!isCapturable(tab?.url)) {
    setBadge("—", COLOR_NEUTRAL);
    clearBadgeSoon();
    return;
  }

  // Config is set manually in Slice 1 (no options UI yet). Missing config = fail.
  const { backendUrl, writeToken } = await chrome.storage.sync.get([
    "backendUrl",
    "writeToken",
  ]);
  if (!backendUrl || !writeToken) {
    setBadge("✗", COLOR_FAIL);
    clearBadgeSoon();
    return;
  }

  try {
    const res = await fetch(`${backendUrl}/api/save`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${writeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPayload({ url: tab!.url!, title: tab!.title })),
    });

    // Only read JSON on success; an error body may not be JSON.
    const outcome = res.ok ? (await res.json()).outcome : undefined;
    const state = mapResponseToState(res.status, outcome);

    if (state === "saved" || state === "duplicate") {
      setBadge("✓", COLOR_OK);
      clearBadgeSoon();
    } else {
      setBadge("✗", COLOR_FAIL);
      clearBadgeSoon();
    }
  } catch {
    // Network failure (offline, DNS, etc.) — same terminal failure badge.
    setBadge("✗", COLOR_FAIL);
    clearBadgeSoon();
  }
});
