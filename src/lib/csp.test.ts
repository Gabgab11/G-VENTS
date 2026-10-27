import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./csp";

describe("security headers", () => {
  it("limits connections and images to the site and the Supabase project", () => {
    const csp = contentSecurityPolicy("https://abcd.supabase.co/");
    expect(csp).toContain("connect-src 'self' https://abcd.supabase.co");
    expect(csp).toContain("img-src 'self' data: blob: https://abcd.supabase.co");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toMatch(/script-src[^;]*https?:/);
  });

  it("allows only Cloudflare Turnstile's script and frame when bot protection is on (FR-1.7)", () => {
    const csp = contentSecurityPolicy("https://abcd.supabase.co", true);
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com");
    expect(csp).toContain("frame-src https://www.google.com https://challenges.cloudflare.com");
    expect(contentSecurityPolicy("https://abcd.supabase.co")).toContain("frame-src https://www.google.com;");
  });

  it("asks browsers to upgrade to https only when the site is served over https", () => {
    expect(contentSecurityPolicy(undefined)).toContain("upgrade-insecure-requests");
    expect(contentSecurityPolicy(undefined, false, false)).not.toContain("upgrade-insecure-requests");
  });

  it("works without a Supabase URL", () => {
    expect(contentSecurityPolicy(undefined)).toContain("connect-src 'self';");
    expect(contentSecurityPolicy("not a url")).toContain("connect-src 'self';");
  });

  it("lets this site use the camera (door scanner) and nothing else", () => {
    const policy = securityHeaders(undefined).find((h) => h.key === "Permissions-Policy")!.value;
    expect(policy).toContain("camera=(self)");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
  });
});
