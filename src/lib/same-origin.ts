// Uploads go to plain route handlers instead of Server Actions: Cloudflare's managed WAF rule
// "React - Leaking Server Functions - CVE:CVE-2025-55183" inspects every Server Action request
// (`Next-Action` header) and blocks some images and PDFs, whose bytes happen to match it. Route
// handlers aren't Server Actions, so the rule doesn't apply (tested on staging, 2026-11-15).
//
// Server Actions check the Origin header themselves; these routes must too, so another site can't
// make a signed-in browser upload a file. (The session cookie is SameSite=Lax, which already keeps
// it off cross-site POSTs; this is the second lock.)

/** True when the request comes from a page of this site. */
export function isSameOrigin(request: Request): boolean {
  const site = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin) return origin === site;
  // No Origin header (some older browsers on same-origin form posts): fall back to Fetch Metadata.
  return request.headers.get("sec-fetch-site") === "same-origin";
}
