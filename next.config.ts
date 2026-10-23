import type { NextConfig } from "next";

// Baseline security headers for every page (review finding M6).
// - No page may be framed by another site, so buttons such as "Check in" on the
//   ticket page can't be clickjacked.
// - Browsers always use HTTPS for two years (HSTS). Subdomains are left out on
//   purpose: send.gventz.com and rsend.gventz.com are email records, not websites.
// - Motion sensors are allowed for this site only (the home page tilt game);
//   the camera, microphone and location are off until a feature needs them.
// A full Content-Security-Policy for scripts and styles needs nonces and moving
// the inline <style> blocks into CSS files first; it is not set yet.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "accelerometer=(self), gyroscope=(self), magnetometer=(self), camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  experimental: {
    // Raised for flyer uploads (5 MB image plus form overhead). Next.js applies this to
    // every server action; the other actions cap their own input sizes in src/lib/forms.ts.
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
