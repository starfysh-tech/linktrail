/**
 * Offline retry queue — the impure layer (chrome.storage.local + fetch) over the
 * pure queue decisions in ./capture. Shared by both save paths (sw.ts shortcut,
 * popup.ts button) so parking and flushing behave identically everywhere.
 *
 * Side effects live here on purpose: capture.ts stays a pure, unit-tested seam
 * (PRD Seam 3); this module is thin glue verified manually, like sw.ts/popup.ts.
 */
import { buildPayload, enqueueItem, flushDisposition, type QueuedCapture } from "./capture";

const STORAGE_KEY = "captureQueue";

/** Read the parked-capture queue (empty if never written). */
export async function readQueue(): Promise<QueuedCapture[]> {
  const { [STORAGE_KEY]: queue } = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(queue) ? (queue as QueuedCapture[]) : [];
}

/** Park a capture for later retry (dedup + cap handled by the pure helper). */
export async function enqueueCapture(input: { url: string; title?: string }): Promise<void> {
  const item: QueuedCapture = {
    url: input.url,
    title: input.title ?? "",
    queuedAt: Date.now(),
  };
  const queue = await readQueue();
  await chrome.storage.local.set({ [STORAGE_KEY]: enqueueItem(queue, item) });
}

/**
 * Attempt to save every parked capture. Items that save (200) or are permanently
 * invalid (400) are removed; transient/fixable failures stay. Returns the count
 * that actually reached the trail (200) so the caller can reassure the user.
 */
export async function flushQueue(backendUrl: string, writeToken: string): Promise<number> {
  const queue = await readQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedCapture[] = [];
  let synced = 0;

  for (const item of queue) {
    let status = 0; // network/thrown errors → 0 (kept, like a temporary failure).
    try {
      const res = await fetch(`${backendUrl}/api/save`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${writeToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayload({ url: item.url, title: item.title })),
      });
      status = res.status;
    } catch {
      status = 0;
    }

    if (flushDisposition(status) === "keep") {
      remaining.push(item);
    } else if (status === 200) {
      synced++; // saved or duplicate — it's in the trail now.
    }
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: remaining });
  return synced;
}
