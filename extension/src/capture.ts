/**
 * Pure capture-decision functions — the testable seam (PRD Seam 3).
 *
 * Deliberately free of any `chrome.*` or `fetch` calls so these can be unit
 * tested in isolation; the service worker (sw.ts) wires them to the runtime.
 */
import { normalizeUrl } from "../../lib/normalize";
import type { SaveRequest, SaveOutcome } from "../../lib/contract";

/**
 * The full six-state capture model. Slice 1 only drives a subset
 * ("saved" / "duplicate" / "failed" / "not-capturable"), but the type is
 * defined whole so later slices don't have to widen it.
 */
export type CaptureState =
  | "ready"
  | "saving"
  | "saved"
  | "duplicate"
  | "queued"
  | "failed"
  | "not-capturable";

/**
 * A capture that failed transiently and was parked for retry. The queue lives in
 * `chrome.storage.local` (device-local, bounded); identity for dedupe is the
 * SHARED normalized URL, so a page queued twice collapses to one entry.
 */
export interface QueuedCapture {
  url: string;
  title: string;
  /** Epoch ms when first parked — used only for ordering/diagnostics. */
  queuedAt: number;
}

/** Max parked captures kept in storage; oldest are dropped past this bound. */
export const QUEUE_MAX = 100;

/**
 * Only http(s) pages are capturable. Everything else — browser-internal pages
 * (chrome://, about:), local files, data/view-source URIs, the new-tab page, or
 * an undefined/malformed URL — is skipped before we ever touch the backend.
 */
export function isCapturable(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Assemble the wire payload; title defaults to empty (server applies fallback). */
export function buildPayload(input: { url: string; title?: string }): SaveRequest {
  return { url: input.url, title: input.title ?? "" };
}

/**
 * Map an HTTP response to a capture state.
 *
 * Slice 1 collapses both 4xx and 5xx to "failed"; Slice 5 will split them for
 * distinct user-facing routing (retry vs. config error).
 */
export function mapResponseToState(status: number, outcome?: SaveOutcome): CaptureState {
  if (status === 200) {
    return outcome === "duplicate" ? "duplicate" : "saved";
  }
  return "failed";
}

/**
 * A cleaned-up URL for display in the popup's page card. Runs the SHARED
 * normalization (so the preview reflects the actual dedupe identity) and drops
 * the `https://` scheme for a calmer, Safari-like presentation.
 */
export function previewUrl(rawUrl: string): string {
  try {
    return normalizeUrl(rawUrl).replace(/^https:\/\//, "");
  } catch {
    return rawUrl;
  }
}

/**
 * Failure taxonomy: a config/auth problem (4xx) is fixed in settings; a
 * temporary problem (5xx or a network error, represented as status 0) is fixed
 * by simply triggering capture again. This split drives both the user-facing
 * message and the notification's click action.
 */
export type FailureKind = "config" | "temporary";

export function failureKind(status: number): FailureKind {
  return status >= 400 && status < 500 ? "config" : "temporary";
}

/** Result-strip text for a failed save, by kind. */
export function failureText(kind: FailureKind): string {
  return kind === "config" ? "Check settings" : "Couldn’t save — try again";
}

/**
 * Toolbar badge for a state: text + color. Empty text means "clear the badge".
 * Shared by the service worker (shortcut path) and any other surface.
 */
export function badgeFor(state: CaptureState): { text: string; color: string } {
  switch (state) {
    case "saved":
    case "duplicate":
      return { text: "✓", color: "#34C759" };
    case "queued":
      // Parked for retry — amber, matching the accent, distinct from success/fail.
      return { text: "⏳", color: "#FF9F0A" };
    case "failed":
      return { text: "✗", color: "#FF3B30" };
    case "not-capturable":
      return { text: "—", color: "#8E8E93" };
    case "ready":
    case "saving":
      return { text: "", color: "#8E8E93" };
  }
}

/**
 * Whether a state's badge should auto-clear after ~2s. Success/duplicate and the
 * quiet not-capturable hint clear themselves; a failure persists so the user
 * notices it (cleared on the next capture attempt).
 */
export function badgeAutoClears(state: CaptureState): boolean {
  return (
    state === "saved" ||
    state === "duplicate" ||
    state === "queued" ||
    state === "not-capturable"
  );
}

/**
 * Whether a failed save should be parked for retry rather than surfaced as a
 * hard failure. Only TEMPORARY failures queue — a 5xx or a network error (status
 * 0). Config/auth failures (4xx) are NOT queued: retrying won't help until the
 * user fixes their settings, and parking them would pile up poison.
 */
export function shouldEnqueue(status: number): boolean {
  return failureKind(status) === "temporary";
}

/**
 * Add a capture to the queue: drop any existing entry with the same normalized
 * identity (so re-queuing a page updates rather than duplicates it), append the
 * new one as most-recent, and cap the queue length by evicting the oldest.
 */
export function enqueueItem(
  queue: QueuedCapture[],
  item: QueuedCapture,
  max: number = QUEUE_MAX,
): QueuedCapture[] {
  const key = safeNormalize(item.url);
  const deduped = queue.filter((q) => safeNormalize(q.url) !== key);
  const next = [...deduped, item];
  return next.length > max ? next.slice(next.length - max) : next;
}

/**
 * After a retry attempt, decide a parked item's fate by HTTP status:
 *   - 200 → saved/duplicate: it's in the trail now → remove.
 *   - 400 → permanently invalid (poison) → remove so it can't wedge the queue.
 *   - everything else (401/403 auth, 5xx, network 0) → keep: transient or
 *     fixable, so the item survives until the user fixes config or the net heals.
 */
export function flushDisposition(status: number): "remove" | "keep" {
  return status === 200 || status === 400 ? "remove" : "keep";
}

/** Normalize a URL for dedupe, falling back to the raw string if it won't parse. */
function safeNormalize(url: string): string {
  try {
    return normalizeUrl(url);
  } catch {
    return url;
  }
}

/** Notification shown when a save is parked for retry (the queued outcome). */
export function queuedNotification(): { title: string; message: string } {
  return {
    title: "Linktrail — queued",
    message: "You’re offline. This page will sync automatically when you’re back online.",
  };
}

/** Notification shown when a background flush drains one or more parked captures. */
export function flushedNotification(count: number): { title: string; message: string } {
  const pages = count === 1 ? "page" : "pages";
  return {
    title: "Linktrail — synced",
    message: `${count} queued ${pages} saved to your trail.`,
  };
}

/**
 * The notification to raise for a failure (failures are the ONLY outcome that
 * notifies — success/duplicate stay badge-only). A `config` failure routes the
 * user to settings; a `temporary` one tells them to retry.
 */
export function failureNotification(kind: FailureKind): { title: string; message: string } {
  return kind === "config"
    ? {
        title: "Linktrail — check settings",
        message: "Your backend URL or write token needs attention.",
      }
    : {
        title: "Linktrail — couldn’t save",
        message: "A temporary problem. Trigger capture again to retry.",
      };
}

/**
 * Whether to show the subtle "already in your trail" hint when the popup opens.
 *
 * True ONLY for a clean 200 whose body reports `saved: true`. Any other status
 * (auth/validation error, 5xx, network failure represented elsewhere) yields
 * false: the hint is purely additive, so an unreachable or undeployed status
 * endpoint simply shows no hint and never disturbs the normal "ready" view.
 */
export function shouldShowSavedHint(status: number, body?: { saved?: boolean }): boolean {
  return status === 200 && body?.saved === true;
}

/** Copy for the on-open "already saved" hint (centralized for testability). */
export function savedHintText(): string {
  return "Already in your trail";
}

/**
 * Build the authenticated deep-link into the review app, or null if we can't
 * (no backend / no feed configured yet). The read token is lifted from the
 * stored feed URL — the popup never stores the read token separately — and the
 * app lives at `/app/` on the same origin as the backend.
 */
export function reviewUrlFrom(
  backendUrl: string | undefined,
  feedUrl: string | undefined,
): string | null {
  if (!backendUrl || !feedUrl) return null;
  try {
    const token = new URL(feedUrl).searchParams.get("token");
    if (!token) return null;
    const base = backendUrl.replace(/\/+$/, "");
    return `${base}/app/?token=${encodeURIComponent(token)}`;
  } catch {
    return null;
  }
}

/** Result-strip / status-pill text for each capture state. */
export function resultText(state: CaptureState): string {
  switch (state) {
    case "ready":
      return "";
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "duplicate":
      return "Already saved";
    case "queued":
      return "Queued — will retry";
    case "failed":
      return "Couldn’t save — try again";
    case "not-capturable":
      return "Can’t save this page";
  }
}
