import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./same-origin";

const post = (headers: Record<string, string>) => new Request("https://staging.gventz.com/api/events/x/flyer", { method: "POST", headers });

describe("isSameOrigin (upload routes outside Server Actions)", () => {
  it("accepts a post from this site", () => {
    expect(isSameOrigin(post({ origin: "https://staging.gventz.com" }))).toBe(true);
  });

  it("refuses another site, another scheme or a look-alike host", () => {
    expect(isSameOrigin(post({ origin: "https://evil.example" }))).toBe(false);
    expect(isSameOrigin(post({ origin: "http://staging.gventz.com" }))).toBe(false);
    expect(isSameOrigin(post({ origin: "https://staging.gventz.com.evil.example" }))).toBe(false);
    expect(isSameOrigin(post({ origin: "null" }))).toBe(false);
  });

  it("without an Origin header, trusts only Fetch Metadata saying same-origin", () => {
    expect(isSameOrigin(post({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(post({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOrigin(post({}))).toBe(false);
  });
});
