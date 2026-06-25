/**
 * Backend CORS support. The extension service worker calls the save endpoint
 * from a `chrome-extension://` origin with an `Authorization` header, which
 * triggers a CORS preflight — so the backend must answer `OPTIONS` and echo
 * permissive CORS headers on every response. Backend-only (not imported by the
 * extension); lives in lib/ so it isn't treated as a Vercel function route.
 *
 * Permissive `*` is safe here: requests are token-authenticated via the
 * `Authorization` header, not cookies, so no credentialed-CORS constraints apply.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

/** Answer a CORS preflight request. */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
