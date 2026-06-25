/**
 * Pure capture-decision functions — the testable seam (PRD Seam 3).
 *
 * Deliberately free of any `chrome.*` or `fetch` calls so these can be unit
 * tested in isolation; the service worker (sw.ts) wires them to the runtime.
 */
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
