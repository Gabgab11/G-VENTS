// Security headers for every page (review finding M6, SECURITY-04).
//
// Scripts: 'self' plus inline, because Next.js writes inline bootstrap scripts and the home page is
// static (rendered once, refreshed every minute), so a per-request nonce can't be in its HTML.
// Every other source of script is refused, and so are plugins, framing and foreign base URLs.
// Connections go to this site only: sign-in and every API call run on the server, so the browser
// never talks to Supabase. Images may also come from the Supabase project (flyers).
// With bot protection on (FR-1.7), Cloudflare Turnstile's script and its challenge frame are allowed too.
// Frames: Google Maps for the venue map on event pages.
// Cloudflare Web Analytics (Change 4, Step 14): its beacon script and the endpoint it reports to.
// The venue's static map image (Step 10) comes from Google only when its key is set.
// `next dev` evaluates its bundles with eval(), so the dev server alone also allows 'unsafe-eval';
// without it React never starts and nothing on the page responds. Production builds never get it.

export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
export const GOOGLE_MAPS_ORIGIN = "https://www.google.com";
export const CF_ANALYTICS_SCRIPT_ORIGIN = "https://static.cloudflareinsights.com";
export const CF_ANALYTICS_ORIGIN = "https://cloudflareinsights.com";
export const GOOGLE_STATIC_MAPS_ORIGIN = "https://maps.googleapis.com";

// upgrade-insecure-requests only where the site is served over https: on http://localhost it makes
// browsers (Safari) fetch the CSS and scripts over https, which fails and leaves the page unstyled.
export function contentSecurityPolicy(
  supabaseUrl: string | undefined,
  turnstile = false,
  https = true,
  dev = false,
  staticMapsKey: string | undefined = process.env.NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY,
): string {
  let supabase = "";
  try {
    supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
  } catch {
    supabase = "";
  }
  const extra = supabase ? ` ${supabase}` : "";
  const challenge = turnstile ? ` ${TURNSTILE_ORIGIN}` : "";
  const evalInDev = dev ? " 'unsafe-eval'" : "";
  const staticMaps = staticMapsKey ? ` ${GOOGLE_STATIC_MAPS_ORIGIN}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${evalInDev} ${CF_ANALYTICS_SCRIPT_ORIGIN}${challenge}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${extra}${staticMaps}`,
    "font-src 'self' data:",
    `connect-src 'self' ${CF_ANALYTICS_ORIGIN}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    `frame-src ${GOOGLE_MAPS_ORIGIN}${challenge}`,
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function securityHeaders(supabaseUrl: string | undefined, turnstile = false, https = true, dev = false): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(supabaseUrl, turnstile, https, dev) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // The camera is for the door scanner on this site; motion sensors for the home page tilt game.
    { key: "Permissions-Policy", value: "accelerometer=(self), gyroscope=(self), magnetometer=(self), camera=(self), microphone=(), geolocation=(), payment=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // Browsers that have seen the site over https never use plain http for it again. Vercel added this
    // header itself; Cloudflare doesn't, so the site sends it. Two years, like Vercel. No
    // includeSubDomains or preload: those cover hosts this app doesn't serve and are hard to undo.
    // Only over https, so http://localhost isn't pinned.
    ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=63072000" }] : []),
  ];
}
