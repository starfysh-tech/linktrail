/**
 * Shared URL normalization — imported by BOTH the extension and the backend.
 *
 * CRITICAL: the two sides must run *identical* normalization, or they compute
 * different identities and create phantom duplicate captures. Never fork or
 * reimplement this per side.
 *
 * Moderate policy: canonicalize the scheme to https, lowercase the host, drop a
 * leading `www.`, drop default ports, the fragment, and a trailing slash; strip
 * known tracking params while preserving meaningful ones. The original URL is
 * kept separately (it is the RSS link target) — this is only the dedupe identity.
 */

/** Exact param names that are pure tracking noise. */
const TRACKING_EXACT = new Set(["fbclid", "gclid", "ref"]);

/** A query param is tracking if it is a known prefix family or an exact match. */
function isTrackingParam(key: string): boolean {
  const k = key.toLowerCase();
  return k.startsWith("utm_") || k.startsWith("mc_") || TRACKING_EXACT.has(k);
}

export function normalizeUrl(raw: string): string {
  const u = new URL(raw);

  // The key is always https so http/https variants of a page share one identity.
  let host = u.hostname; // URL already lowercases the host
  if (host.startsWith("www.")) host = host.slice(4);

  // Drop a single trailing slash, but the bare-root path collapses to empty.
  let path = u.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path === "/") path = "";

  // Keep meaningful params in their original order; drop tracking noise.
  const kept: string[] = [];
  for (const [key, value] of u.searchParams) {
    if (!isTrackingParam(key)) {
      kept.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  const query = kept.length ? `?${kept.join("&")}` : "";

  // Default ports and the fragment are dropped by simply not re-emitting them.
  return `https://${host}${path}${query}`;
}
