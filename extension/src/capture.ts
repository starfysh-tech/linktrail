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
  | "failed"
  | "not-capturable";

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
  return state === "saved" || state === "duplicate" || state === "not-capturable";
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
    case "failed":
      return "Couldn’t save — try again";
    case "not-capturable":
      return "Can’t save this page";
  }
}
