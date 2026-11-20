import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./csp";

describe("security headers", () => {
  it("limits connections to the site (and Cloudflare's analytics) and images to the site and the Supabase project", () => {
    const csp = contentSecurityPolicy("https://abcd.supabase.co/", false, true, false, "");
    // The browser never calls Supabase: sign-in runs in server actions.
    expect(csp).toContain("connect-src 'self' https://cloudflareinsights.com;");
    expect(csp).toContain("img-src 'self' data: blob: https://abcd.supabase.co;");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    // The only script from elsewhere is Cloudflare Web Analytics' beacon.
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com;");
  });

  it("allows Cloudflare Web Analytics: its script and the endpoint it reports to (Step 14)", () => {
    const csp = contentSecurityPolicy(undefined, false, true, false, "");
    expect(csp).toMatch(/script-src [^;]*https:\/\/static\.cloudflareinsights\.com/);
    expect(csp).toMatch(/connect-src [^;]*https:\/\/cloudflareinsights\.com/);
    expect(csp).not.toMatch(/connect-src [^;]*static\.cloudflareinsights/);
  });

  it("allows Google's static map images only when the static map key is set (Step 10)", () => {
    expect(contentSecurityPolicy(undefined, false, true, false, "AIza-test")).toContain("img-src 'self' data: blob: https://maps.googleapis.com;");
    expect(contentSecurityPolicy("https://abcd.supabase.co", false, true, false, "AIza-test")).toContain("img-src 'self' data: blob: https://abcd.supabase.co https://maps.googleapis.com;");
    expect(contentSecurityPolicy(undefined, false, true, false, "")).not.toContain("maps.googleapis.com");
    expect(contentSecurityPolicy(undefined, false, true, false, undefined)).not.toContain("maps.googleapis.com");
  });

  it("allows only Cloudflare Turnstile's script and frame when bot protection is on (FR-1.7)", () => {
    const csp = contentSecurityPolicy("https://abcd.supabase.co", true);
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://challenges.cloudflare.com");
    expect(csp).toContain("frame-src https://www.google.com https://challenges.cloudflare.com");
    expect(contentSecurityPolicy("https://abcd.supabase.co")).toContain("frame-src https://www.google.com;");
  });

  it("asks browsers to upgrade to https only when the site is served over https", () => {
    expect(contentSecurityPolicy(undefined)).toContain("upgrade-insecure-requests");
    expect(contentSecurityPolicy(undefined, false, false)).not.toContain("upgrade-insecure-requests");
  });

  it("pins browsers to https (HSTS) only when the site is served over https", () => {
    const hsts = (https: boolean) => securityHeaders(undefined, false, https).find((h) => h.key === "Strict-Transport-Security");
    expect(hsts(true)?.value).toBe("max-age=63072000");
    expect(hsts(false)).toBeUndefined();
  });

  it("allows eval only for the dev server", () => {
    expect(contentSecurityPolicy(undefined)).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy(undefined, false, false, true)).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com;");
  });

  it("works without a Supabase URL", () => {
    expect(contentSecurityPolicy(undefined, false, true, false, "")).toContain("img-src 'self' data: blob:;");
    expect(contentSecurityPolicy("not a url", false, true, false, "")).toContain("img-src 'self' data: blob:;");
  });

  it("lets this site use the camera (door scanner) and nothing else", () => {
    const policy = securityHeaders(undefined).find((h) => h.key === "Permissions-Policy")!.value;
    expect(policy).toContain("camera=(self)");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
  });
});
