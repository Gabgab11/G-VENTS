import { describe, expect, it } from "vitest";
import { authCookieOptions, forwardedIp, isIpAddress, supabaseKeyAndHeaders } from "./options";

const from = (h: Record<string, string>) => (name: string) => h[name] ?? null;

describe("forwardedIp", () => {
  it("on Cloudflare uses only cf-connecting-ip, never a visitor-sent x-forwarded-for", () => {
    expect(forwardedIp(from({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1" }), true)).toBe("203.0.113.9");
    expect(forwardedIp(from({ "x-forwarded-for": "198.51.100.1" }), true)).toBeNull();
    expect(forwardedIp(from({ "cf-connecting-ip": "2001:db8::1" }), true)).toBe("2001:db8::1");
  });

  it("rejects anything that isn't a bare IP", () => {
    for (const bad of ["junk", "1.2.3.4:80", "256.1.1.1", "1.2.3", "[2001:db8::1]", "1.2.3.4, 5.6.7.8", ""]) {
      expect(forwardedIp(from({ "cf-connecting-ip": bad }), true)).toBeNull();
    }
    for (const good of ["10.0.0.1", "::1", "2001:db8::1", "2001:0db8:0000:0000:0000:ff00:0042:8329", "::ffff:192.0.2.1", "fe80::"]) {
      expect(isIpAddress(good), good).toBe(true);
    }
    for (const bad of ["1:2:3:4:5:6:7", "1::2::3", "12345::1", "1:2:3:4:5:6:7:8:9", "::ffff:999.0.2.1", "2001:db8::1%eth0"]) {
      expect(isIpAddress(bad), bad).toBe(false);
    }
  });

  it("off Cloudflare forwards nothing (a cf-connecting-ip header there came from the visitor)", () => {
    expect(forwardedIp(from({ "cf-connecting-ip": "203.0.113.9" }), false)).toBeNull();
  });
});

describe("supabaseKeyAndHeaders", () => {
  it("with the secret key, forwards the visitor's IP", () => {
    expect(supabaseKeyAndHeaders({ secretKey: "sb_secret_x", publishableKey: "sb_publishable_y", ip: "203.0.113.9" })).toEqual({
      key: "sb_secret_x",
      headers: { "sb-forwarded-for": "203.0.113.9" },
    });
    expect(supabaseKeyAndHeaders({ secretKey: "sb_secret_x", publishableKey: "p", ip: null }).headers).toEqual({});
  });

  it("without it, keeps the publishable key and sends no header (Supabase ignores it for those keys)", () => {
    expect(supabaseKeyAndHeaders({ secretKey: "", publishableKey: "sb_publishable_y", ip: "203.0.113.9" })).toEqual({
      key: "sb_publishable_y",
      headers: {},
    });
  });
});

describe("authCookieOptions", () => {
  it("is httpOnly and lax everywhere, secure on https", () => {
    expect(authCookieOptions("https://gventz.com")).toEqual({ path: "/", sameSite: "lax", httpOnly: true, secure: true });
    expect(authCookieOptions("http://localhost:3000")).toMatchObject({ httpOnly: true, secure: false });
  });
});
