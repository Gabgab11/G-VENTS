import { describe, expect, it } from "vitest";
import { onCloudflare, visitorCountry } from "./platform";

const req = (h: Record<string, string>) => (name: string) => h[name] ?? null;

describe("visitorCountry", () => {
  it("reads only the serving network's header", () => {
    const both = { "cf-ipcountry": "ng", "x-vercel-ip-country": "GB" };
    expect(visitorCountry(req(both), true)).toBe("NG");
    expect(visitorCountry(req(both), false)).toBe("GB");
    expect(visitorCountry(req({ "x-vercel-ip-country": "GB" }), true)).toBeNull();
  });

  it("drops Cloudflare's no-country codes and junk", () => {
    expect(visitorCountry(req({ "cf-ipcountry": "XX" }), true)).toBeNull();
    expect(visitorCountry(req({ "cf-ipcountry": "T1" }), true)).toBeNull();
    expect(visitorCountry(req({ "cf-ipcountry": "<script>" }), true)).toBeNull();
  });

  it("is not on Cloudflare under Node.js", () => {
    expect(onCloudflare()).toBe(false);
  });
});
