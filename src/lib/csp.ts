// Security headers for every page (review finding M6, SECURITY-04).
//
// Scripts: 'self' plus inline, because Next.js writes inline bootstrap scripts and the home page is
// static (rendered once, refreshed every minute), so a per-request nonce can't be in its HTML.
// Every other source of script is refused, and so are plugins, framing and foreign base URLs.
// Connections and images are limited to this site and the Supabase project (sign-in, flyers).
// With bot protection on (FR-1.7), Cloudflare Turnstile's script and its challenge frame are allowed too.
// Frames: Google Maps for the venue map on event pages.

export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
export const GOOGLE_MAPS_ORIGIN = "https://www.google.com";

// upgrade-insecure-requests only where the site is served over https: on http://localhost it makes
// browsers (Safari) fetch the CSS and scripts over https, which fails and leaves the page unstyled.
export function contentSecurityPolicy(supabaseUrl: string | undefined, turnstile = false, https = true): string {
  let supabase = "";
  try {
    supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
  } catch {
    supabase = "";
  }
  const extra = supabase ? ` ${supabase}` : "";
  const challenge = turnstile ? ` ${TURNSTILE_ORIGIN}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${challenge}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${extra}`,
    "font-src 'self' data:",
    `connect-src 'self'${extra}`,
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

export function securityHeaders(supabaseUrl: string | undefined, turnstile = false, https = true): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(supabaseUrl, turnstile, https) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // The camera is for the door scanner on this site; motion sensors for the home page tilt game.
    { key: "Permissions-Policy", value: "accelerometer=(self), gyroscope=(self), magnetometer=(self), camera=(self), microphone=(), geolocation=(), payment=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
