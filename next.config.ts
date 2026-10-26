import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/csp";

// Vercel always serves https; elsewhere (local `next start`) follow the site URL.
const servedOverHttps = process.env.VERCEL === "1" || (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

const nextConfig: NextConfig = {
  experimental: {
    // Raised for flyer uploads (5 MB image plus form overhead). Next.js applies this to
    // every server action; the other actions cap their own input sizes in src/lib/forms.ts.
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env.NEXT_PUBLIC_SUPABASE_URL, !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, servedOverHttps) }];
  },
};

export default nextConfig;
