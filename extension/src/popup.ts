/**
 * Glass capture popup controller (Slice 4).
 *
 * Wires the pure capture-decision helpers from `./capture` to the live runtime:
 * reads the active tab, drives the six-state model through a single `render()`,
 * and POSTs to the backend on a save click. All `chrome.*` / `fetch` side effects
 * live here so `capture.ts` stays a unit-testable seam (PRD Seam 3).
 *
 * The markup (popup.html) is authored by a separate track. We rely on its id
 * contract but query defensively so a missing element never throws.
 */
import {
  isCapturable,
  buildPayload,
  mapResponseToState,
  previewUrl,
  resultText,
  failureKind,
  failureText,
  shouldShowSavedHint,
  shouldEnqueue,
  type CaptureState,
} from "./capture";
import { enqueueCapture, flushQueue } from "./queue";
import type { SaveResponse, StatusResponse } from "../../lib/contract";

// Cached element lookups. Nullable: the popup must not crash if markup drifts.
const $ = <T extends HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;

const els = {
  favicon: $<HTMLImageElement>("favicon"),
  title: $("title"),
  urlPreview: $("url-preview"),
  savedHint: $("saved-hint"),
  saveBtn: $<HTMLButtonElement>("save-btn"),
  resultStrip: $("result-strip"),
  openFeed: $("open-feed"),
  openSettings: $("open-settings"),
};

/**
 * Single source of truth for visible state: body class drives CSS, strip shows text.
 *
 * `status` only matters for "failed": it splits the generic failure message into a
 * config-vs-temporary read (4xx -> "Check settings", 5xx/network(0) -> retry). The
 * config-failure fix route is the existing #open-settings link — no extra UI here.
 */
function render(state: CaptureState, status = 0): void {
  document.body.className = `state-${state}`;
  if (els.resultStrip) {
    els.resultStrip.textContent =
      state === "failed" ? failureText(failureKind(status)) : resultText(state);
  }
}

async function init(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Populate the page card from the tab metadata.
  if (els.favicon) {
    if (tab?.favIconUrl) {
      els.favicon.src = tab.favIconUrl;
      els.favicon.hidden = false;
    } else {
      els.favicon.hidden = true;
    }
  }
  if (els.title) els.title.textContent = tab?.title ?? "";
  if (els.urlPreview) els.urlPreview.textContent = previewUrl(tab?.url ?? "");

  // Non-http(s) pages can never be saved — short-circuit before any backend wiring.
  if (!isCapturable(tab?.url)) {
    render("not-capturable");
    if (els.saveBtn) els.saveBtn.disabled = true;
    return;
  }

  render("ready");

  els.saveBtn?.addEventListener("click", () => void save(tab));
  els.openFeed?.addEventListener("click", () => void openFeed());
  els.openSettings?.addEventListener("click", () => chrome.runtime.openOptionsPage());

  // Fire-and-forget: reveal the "already saved" hint if the backend confirms it.
  // Never awaited and never blocks Save — a slow/offline/undeployed status
  // endpoint simply leaves the normal ready view untouched.
  void maybeShowSavedHint(tab);

  // Opportunistic drain: opening the popup while online is a good moment to
  // retry anything parked earlier. Silent and non-blocking.
  void flushOnOpen();
}

/** Best-effort flush of the retry queue when the popup opens; never throws. */
async function flushOnOpen(): Promise<void> {
  const { backendUrl, writeToken } = await chrome.storage.sync.get(["backendUrl", "writeToken"]);
  if (!backendUrl || !writeToken) return;
  try {
    await flushQueue(backendUrl, writeToken);
  } catch {
    // Offline / unreachable — leave the queue intact for the next trigger.
  }
}

/**
 * Ask the backend whether the current tab is already in the trail and, if so,
 * reveal the subtle hint. Stays silent on missing config or any error: the hint
 * is purely additive, so failure degrades to "no hint", never to a blocked save.
 */
async function maybeShowSavedHint(tab: chrome.tabs.Tab): Promise<void> {
  const { backendUrl, writeToken } = await chrome.storage.sync.get(["backendUrl", "writeToken"]);
  if (!backendUrl || !writeToken || !tab.url) return;

  try {
    const res = await fetch(`${backendUrl}/api/status?url=${encodeURIComponent(tab.url)}`, {
      headers: { Authorization: `Bearer ${writeToken}` },
    });
    const body = res.ok ? ((await res.json()) as StatusResponse) : undefined;
    if (shouldShowSavedHint(res.status, body) && els.savedHint) {
      els.savedHint.hidden = false;
    }
  } catch {
    // Offline / DNS / CORS — stay quiet, leave the ready view as-is.
  }
}

/** POST the current tab to the backend and reflect the outcome in the UI. */
async function save(tab: chrome.tabs.Tab): Promise<void> {
  render("saving");

  // A missing backend URL / token is a config problem: route it through the 4xx
  // branch (-> "Check settings") so the fix is the #open-settings link.
  const { backendUrl, writeToken } = await chrome.storage.sync.get([
    "backendUrl",
    "writeToken",
  ]);
  if (!backendUrl || !writeToken) {
    render("failed", 401);
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
      body: JSON.stringify(buildPayload({ url: tab.url!, title: tab.title })),
    });
    status = res.status;
    const outcome = res.ok ? ((await res.json()) as SaveResponse).outcome : undefined;
    state = mapResponseToState(status, outcome);
  } catch {
    // Network error (offline, DNS, CORS) — distinct from an HTTP error status.
    state = "failed";
  }

  // Park a temporary failure for background retry instead of losing it; the user
  // sees the reassuring "Queued — will retry" pill rather than a hard error.
  if (state === "failed" && shouldEnqueue(status)) {
    await enqueueCapture({ url: tab.url!, title: tab.title });
    state = "queued";
  }

  render(state, status);
}

/** Open the saved feed URL, or fall back to options if it hasn't been configured yet. */
async function openFeed(): Promise<void> {
  const { feedUrl } = await chrome.storage.sync.get("feedUrl");
  if (feedUrl) {
    await chrome.tabs.create({ url: feedUrl });
  } else {
    chrome.runtime.openOptionsPage();
  }
}

document.addEventListener("DOMContentLoaded", () => void init());
