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
