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
 * A saved item as returned by `GET /api/items` and consumed by the review web
 * app. Read-only projection of `saved_items` — the normalized URL stays
 * server-side. `capturedAt` is an ISO-8601 string for portable client parsing.
 */
export interface Item {
  id: string;
  url: string;
  title: string;
  capturedAt: string;
}

/**
 * Status endpoint response. The popup calls this on open to learn whether the
 * current tab is already in the trail, so it can show a subtle "already saved"
 * hint. `saved` is the only thing the popup needs; `id` is returned for parity
 * with the save contract and possible future use (e.g. deep-linking).
 */
export interface StatusResponse {
  saved: boolean;
  id?: string;
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
