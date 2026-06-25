/**
 * Options / first-run setup page. The user enters the backend URL + write token;
 * "Test connection" verifies them and, on success, stores + displays the feed URL
 * (the read token lives inside that URL — the user never types it). All persisted
 * keys (`backendUrl`, `writeToken`, `feedUrl`) are the same chrome.storage.sync
 * keys the service worker reads at capture time.
 */
import type { VerifyResponse } from "../../lib/contract";

const COMMAND_ID = "capture-current-tab";

/**
 * Pure response→message decision, split out from DOM wiring so it can be unit
 * tested without chrome/DOM mocks. `body` is null when the request never got a
 * parseable response (network failure / non-JSON), signalled by `status === 0`.
 */
export function verifyResultMessage(
  status: number,
  body: VerifyResponse | null,
): { ok: boolean; message: string } {
  if (status === 200 && body?.ok) {
    return { ok: true, message: "Connected." };
  }
  if (status === 401) {
    return { ok: false, message: "Check your write token." };
  }
  // status 0 (network/non-JSON) or any other non-ok response: the backend
  // wasn't reachable in a usable way. Prefer a server-provided error if present.
  return {
    ok: false,
    message: body?.error ?? "Couldn't reach the backend — check the URL.",
  };
}

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

function showResult(message: string, ok: boolean): void {
  const result = $<HTMLDivElement>("result");
  result.textContent = message;
  result.dataset.state = ok ? "ok" : "fail";
  result.hidden = false;
}

function showFeed(feedUrl: string): void {
  $<HTMLInputElement>("feed-url").value = feedUrl;
  $<HTMLElement>("feed-section").hidden = false;
}

async function loadSettings(): Promise<void> {
  const { backendUrl, writeToken, feedUrl } = await chrome.storage.sync.get([
    "backendUrl",
    "writeToken",
    "feedUrl",
  ]);
  if (backendUrl) $<HTMLInputElement>("backend-url").value = backendUrl;
  if (writeToken) $<HTMLInputElement>("write-token").value = writeToken;
  if (feedUrl) showFeed(feedUrl);
}

async function loadShortcut(): Promise<void> {
  const commands = await chrome.commands.getAll();
  const command = commands.find((c) => c.name === COMMAND_ID);
  $<HTMLElement>("shortcut").textContent =
    command?.shortcut || "Not set — click Change shortcut";
}

async function handleSave(): Promise<void> {
  const backendUrl = $<HTMLInputElement>("backend-url").value.trim();
  const writeToken = $<HTMLInputElement>("write-token").value.trim();
  await chrome.storage.sync.set({ backendUrl, writeToken });
  showResult("Saved.", true);
}

async function handleTest(): Promise<void> {
  const backendUrl = $<HTMLInputElement>("backend-url").value.trim();
  const writeToken = $<HTMLInputElement>("write-token").value.trim();

  let status = 0;
  let body: VerifyResponse | null = null;
  try {
    const res = await fetch(`${backendUrl}/api/verify`, {
      headers: { Authorization: `Bearer ${writeToken}` },
    });
    status = res.status;
    // Body may be non-JSON on an error; tolerate that and fall back to status 0.
    try {
      body = (await res.json()) as VerifyResponse;
    } catch {
      body = null;
    }
  } catch {
    // Network failure (offline, DNS, bad URL): status stays 0, body null.
  }

  const { ok, message } = verifyResultMessage(status, body);
  if (ok && body?.feedUrl) {
    await chrome.storage.sync.set({ feedUrl: body.feedUrl });
    showFeed(body.feedUrl);
  }
  showResult(message, ok);
}

async function handleCopy(): Promise<void> {
  await navigator.clipboard.writeText($<HTMLInputElement>("feed-url").value);
}

function init(): void {
  $("save").addEventListener("click", handleSave);
  $("test").addEventListener("click", handleTest);
  $("copy").addEventListener("click", handleCopy);
  $("change-shortcut").addEventListener("click", () => {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });
  void loadSettings();
  void loadShortcut();
}

// Only wire the DOM in a browser context; the pure helper above is importable
// from Bun tests without triggering this.
if (typeof document !== "undefined") {
  init();
}
