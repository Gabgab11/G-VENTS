import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { middleware } from "./middleware";

const req = (cookie?: string) => new NextRequest("http://localhost:3000/e/some-event", { headers: cookie ? { cookie } : {} });

describe("maintenance switch (go-live cut-over)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("passes requests through normally", async () => {
    expect((await middleware(req())).status).toBe(200);
  });

  it("answers 503 with the notice while MAINTENANCE_MODE=1", async () => {
    vi.stubEnv("MAINTENANCE_MODE", "1");
    const res = await middleware(req());
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("600");
    expect(await res.text()).toContain("We're updating G-ventZ");
  });

  it("lets staff through with the bypass cookie, and only with the right, long-enough value", async () => {
    vi.stubEnv("MAINTENANCE_MODE", "1");
    vi.stubEnv("MAINTENANCE_BYPASS", "a-long-random-bypass-value");
    expect((await middleware(req("gventz_bypass=a-long-random-bypass-value"))).status).toBe(200);
    expect((await middleware(req("gventz_bypass=wrong"))).status).toBe(503);
    vi.stubEnv("MAINTENANCE_BYPASS", "short");
    expect((await middleware(req("gventz_bypass=short"))).status).toBe(503);
  });
});

describe("https redirect", () => {
  afterEach(() => vi.unstubAllEnvs());
  const at = (url: string, proto?: string) => middleware(new NextRequest(url, { headers: proto ? { "x-forwarded-proto": proto } : {} }));

  it("sends plain http on the site's host to https, keeping path and query", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://gventz.com");
    const res = await at("http://gventz.com/discover?city=lagos&page=2");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://gventz.com/discover?city=lagos&page=2");
  });

  it("folds http://www into the apex", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://gventz.com");
    expect((await at("http://www.gventz.com/e/x")).headers.get("location")).toBe("https://gventz.com/e/x");
  });

  it("trusts the edge's x-forwarded-proto over the URL the Worker sees", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://gventz.com");
    expect((await at("http://gventz.com/", "https")).status).toBe(200);
    expect((await at("https://gventz.com/", "http")).status).toBe(301);
  });

  it("covers the information pages too, which still skip the session", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://gventz.com");
    expect((await at("http://gventz.com/terms")).status).toBe(301);
    expect((await at("https://gventz.com/terms", "https")).status).toBe(200);
  });

  it("never redirects other hosts, http sites or https requests", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://gventz.com");
    expect((await at("http://evil.example/x")).status).toBe(200);
    expect((await at("http://localhost:3000/x")).status).toBe(200);
    expect((await at("https://gventz.com/x", "https")).status).toBe(200);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    expect((await at("http://localhost:3000/x")).status).toBe(200);
  });

  it("keeps the information pages out of the maintenance notice, as before", async () => {
    vi.stubEnv("MAINTENANCE_MODE", "1");
    expect((await at("http://localhost:3000/privacy")).status).toBe(200);
    expect((await at("http://localhost:3000/e/x")).status).toBe(503);
  });
});
