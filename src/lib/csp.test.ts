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
