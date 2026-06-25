/**
 * The save-request contract — shared by the extension (sender) and the backend
 * (receiver) so the wire shape can never drift between the two sides.
 */
export interface SaveRequest {
  /** The original page URL exactly as captured (the RSS link target). */
  url: string;
  /** The page title; may be empty (server applies a host fallback in Slice 2). */
  title: string;
}

/**
 * Save outcomes. Slice 1 only ever returns `saved` (plain insert); `duplicate`
 * is part of the contract now so the extension's state mapping is stable when
 * Slice 2 adds dedupe/upsert.
 */
export type SaveOutcome = "saved" | "duplicate";

export interface SaveResponse {
  outcome: SaveOutcome;
  id: string;
}

/**
 * Verify endpoint response ("Test connection" in options). On success the
 * backend returns the feed URL (read token embedded) so the options page can
 * display/store it — the user only ever enters the backend URL + write token.
 */
export interface VerifyResponse {
  ok: boolean;
  feedUrl?: string;
  error?: string;
}
