// Security headers for every page (review finding M6, SECURITY-04).
//
// Scripts: 'self' plus inline, because Next.js writes inline bootstrap scripts and the home page is
// static (rendered once, refreshed every minute), so a per-request nonce can't be in its HTML.
// Every other source of script is refused, and so are plugins, framing and foreign base URLs.
// Connections and images are limited to this site and the Supabase project (sign-in, flyers).

export function contentSecurityPolicy(supabaseUrl: string | undefined): string {
  let supabase = "";
  try {
    supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
  } catch {
    supabase = "";
  }
  const extra = supabase ? ` ${supabase}` : "";
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${extra}`,
    "font-src 'self' data:",
    `connect-src 'self'${extra}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function securityHeaders(supabaseUrl: string | undefined): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(supabaseUrl) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // The camera is for the door scanner on this site; motion sensors for the home page tilt game.
    { key: "Permissions-Policy", value: "accelerometer=(self), gyroscope=(self), magnetometer=(self), camera=(self), microphone=(), geolocation=(), payment=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
