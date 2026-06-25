/**
 * MV3 service worker — Slice 5 feedback & failure UX for the silent shortcut path.
 *
 * Three feedback tiers, all driven by the pure helpers in ./capture so the
 * service worker holds no policy of its own:
 *   - success/duplicate → badge only (✓), auto-clears after ~2s; never notifies.
 *   - not-capturable     → quiet skip; neutral badge, no backend call, no notification.
 *   - failure            → persistent ✗ badge + a single notification (config vs.
 *                          temporary). A config failure's notification opens the
 *                          options page on click. Failures never mutate storage.
 */
import {
  isCapturable,
  buildPayload,
  mapResponseToState,
  badgeFor,
  badgeAutoClears,
  failureKind,
  failureNotification,
  type CaptureState,
} from "./capture";

const BADGE_CLEAR_MS = 2000;

// Notifications require an iconUrl; this 1×1 transparent PNG is a placeholder —
// a real branded icon set is a later polish item (not part of Slice 5).
const ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// Stable id so a repeated failure replaces the prior notification rather than stacking.
const FAIL_NOTIF_ID = "linktrail-capture-failure";

function applyBadge(state: CaptureState): void {
  const { text, color } = badgeFor(state);
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  if (badgeAutoClears(state)) {
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), BADGE_CLEAR_MS);
  }
}

function notifyFailure(kind: ReturnType<typeof failureKind>): void {
  const { title, message } = failureNotification(kind);
  chrome.notifications.create(FAIL_NOTIF_ID, {
    type: "basic",
    iconUrl: ICON,
    title,
    message,
  });
}

// A failure notification is actionable: clicking it routes to settings (the fix
// for a config failure; harmless for a temporary one). Clear it on click.
chrome.notifications.onClicked.addListener((notifId) => {
  if (notifId !== FAIL_NOTIF_ID) return;
  chrome.runtime.openOptionsPage();
  chrome.notifications.clear(notifId);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture-current-tab") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Browser-internal / non-web pages: quiet skip — no backend, no notification.
  if (!isCapturable(tab?.url)) {
    applyBadge("not-capturable");
    return;
  }

  // Missing config is a config-class failure: badge + notification, no state change.
  const { backendUrl, writeToken } = await chrome.storage.sync.get([
    "backendUrl",
    "writeToken",
  ]);
  if (!backendUrl || !writeToken) {
    applyBadge("failed");
    notifyFailure("config");
    return;
  }

  let state: CaptureState;
  let status = 0; // network/thrown errors are represented as status 0 (→ temporary).
  try {
    const res = await fetch(`${backendUrl}/api/save`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${writeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPayload({ url: tab!.url!, title: tab!.title })),
    });
    status = res.status;
    // Only read JSON on success; an error body may not be JSON.
    const outcome = res.ok ? (await res.json()).outcome : undefined;
    state = mapResponseToState(res.status, outcome);
  } catch {
    state = "failed";
  }

  applyBadge(state);

  // Success/duplicate are badge-only. Only a failure notifies.
  if (state === "failed") {
    notifyFailure(failureKind(status));
  }
});
