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
  queuedNotification,
  flushedNotification,
  shouldEnqueue,
  type CaptureState,
} from "./capture";
import { enqueueCapture, flushQueue } from "./queue";
import { packMarkdownGz } from "./extract";
import { readEnrichedHtml } from "./page-reader";
import { parseHTML } from "linkedom";

const BADGE_CLEAR_MS = 2000;

// Periodic retry of parked captures. chrome.alarms (not setInterval) because the
// MV3 service worker is ephemeral; the alarm wakes it even after it's torn down.
const FLUSH_ALARM = "linktrail-flush";
const FLUSH_PERIOD_MIN = 5;

// Notifications require an iconUrl; use the extension's own branded icon.
const ICON = chrome.runtime.getURL("icons/128.png");

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

function notify(id: string, { title, message }: { title: string; message: string }): void {
  chrome.notifications.create(id, { type: "basic", iconUrl: ICON, title, message });
}

/**
 * Read the triggered tab's rendered HTML and pack a gzip'd Markdown archive. The
 * MV3 service worker has no `DOMParser`, so the pure `packMarkdownGz` seam gets a
 * `linkedom`-backed parser (the same DOM-free parser the unit tests use). Returns
 * undefined on any failure so the save degrades to url+title; never throws.
 */
async function packPageMarkdown(tab: chrome.tabs.Tab): Promise<string | undefined> {
  if (!tab.id || !tab.url) return undefined;
  let html: string;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: readEnrichedHtml,
    });
    html = (result?.result as string) ?? "";
  } catch {
    return undefined;
  }
  return packMarkdownGz(
    html,
    tab.url,
    tab.title ?? "",
    (h) => parseHTML(h).document as unknown as Document,
    new Date().toISOString(),
  );
}

/**
 * Drain the retry queue in the background (alarm / startup). Silent when nothing
 * is parked or config is missing; on a successful drain it confirms with a ✓
 * badge + a single "synced N pages" notification so the user knows it caught up.
 */
async function backgroundFlush(): Promise<void> {
  const { backendUrl, writeToken } = await chrome.storage.sync.get(["backendUrl", "writeToken"]);
  if (!backendUrl || !writeToken) return;
  const synced = await flushQueue(backendUrl, writeToken);
  if (synced > 0) {
    applyBadge("saved");
    notify("linktrail-flush-synced", flushedNotification(synced));
  }
}

// Retry triggers: a periodic alarm, browser startup, and install (also (re)arms
// the alarm). The opportunistic flush on each manual capture lives in the
// command handler below.
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MIN });
});
chrome.runtime.onStartup.addListener(() => void backgroundFlush());
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FLUSH_ALARM) void backgroundFlush();
});

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

  // Archive the page as gzip'd Markdown BEFORE the flush/save awaits below, so the
  // activeTab grant still resolves to the page the user triggered on. Best-effort:
  // undefined on any failure, and the save continues url+title only.
  const markdownGz = await packPageMarkdown(tab!);

  // Opportunistic drain: if we're online enough to capture, flush any backlog
  // first. Silent here — the manual capture's own feedback follows.
  await flushQueue(backendUrl, writeToken);

  let state: CaptureState;
  let status = 0; // network/thrown errors are represented as status 0 (→ temporary).
  try {
    const res = await fetch(`${backendUrl}/api/save`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${writeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPayload({ url: tab!.url!, title: tab!.title, markdownGz })),
    });
    status = res.status;
    // Only read JSON on success; an error body may not be JSON.
    const outcome = res.ok ? (await res.json()).outcome : undefined;
    state = mapResponseToState(res.status, outcome);
  } catch {
    state = "failed";
  }

  // A temporary failure is parked for retry rather than lost: enqueue and report
  // the reassuring "queued" outcome instead of a hard failure.
  if (state === "failed" && shouldEnqueue(status)) {
    await enqueueCapture({ url: tab!.url!, title: tab!.title, markdownGz });
    state = "queued";
  }

  applyBadge(state);

  // Success/duplicate/queued are badge-only or get the queued notice; a config
  // failure (the only "failed" left here) notifies the user to fix settings.
  if (state === "queued") {
    notify("linktrail-capture-queued", queuedNotification());
  } else if (state === "failed") {
    notifyFailure(failureKind(status));
  }
});
