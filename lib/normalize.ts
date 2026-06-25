/**
 * Shared URL normalization — imported by BOTH the extension and the backend.
 *
 * CRITICAL: the two sides must run *identical* normalization, or they compute
 * different identities and create phantom duplicate captures. Never fork or
 * reimplement this per side.
 *
 * Slice 1 implements only *basic* normalization — enough to produce a stable
 * dedupe key: canonicalize the scheme to https, lowercase the host, drop the
 * fragment, default ports, and a trailing slash. The full "moderate" policy
 * (www. removal, tracking-param stripping, meaningful-param preservation) is
 * Slice 2, which deepens this same function test-first.
 */
export function normalizeUrl(raw: string): string {
  const u = new URL(raw);

  // The key is always https so http/https variants of a page share one identity.
  const host = u.hostname; // URL already lowercases the host
  // Drop a single trailing slash, but the bare-root path collapses to empty.
  let path = u.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path === "/") path = "";

  // Query preserved verbatim in Slice 1 (tracking-param stripping is Slice 2).
  // Default ports and the fragment are dropped by simply not re-emitting them.
  return `https://${host}${path}${u.search}`;
}
