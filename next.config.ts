import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./src/lib/csp";

// Vercel always serves https; elsewhere (local `next start`) follow the site URL.
const servedOverHttps = process.env.VERCEL === "1" || (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

const nextConfig: NextConfig = {
  experimental: {
    // Raised for flyer uploads (5 MB image plus form overhead). Next.js applies this to
    // every server action; the other actions cap their own input sizes in src/lib/forms.ts.
    serverActions: { bodySizeLimit: "6mb" },
    // Two root layouts (public pages per language, and the rest) share no not-found page (Change 3).
    globalNotFound: true,
  },
  // The design system's index (import { Button } from "@/design") re-exports every component. It has no
  // side effects, so a page only ships the components it uses, not every Radix primitive (NFR-13).
  webpack(config) {
    config.module.rules.push({ test: /[\\/]src[\\/]design[\\/](index|client|cx|token-list)\.ts$/, sideEffects: false });
    return config;
  },
  async headers() {
    return [
      // The service worker must always be fresh, so a new version reaches every device.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] },
      { source: "/:path*", headers: securityHeaders(process.env.NEXT_PUBLIC_SUPABASE_URL, !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, servedOverHttps, process.env.NODE_ENV === "development") },
    ];
  },
};

// next-intl: per-request language and messages (src/i18n/request.ts).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
