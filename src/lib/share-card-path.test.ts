import { describe, expect, it } from "vitest";
import { cardApiPath, cardLanguage } from "./share-card-path";

describe("share card addresses (D81)", () => {
  it("uses the lang parameter only when it is a switched-on language", () => {
    expect(cardLanguage("fr", ["en", "fr"])).toBe("fr");
    expect(cardLanguage("de", ["en", "fr"])).toBe("en");
    expect(cardLanguage("FR", ["en", "fr"])).toBe("en");
    expect(cardLanguage("../../etc", ["en", "fr"])).toBe("en");
    expect(cardLanguage(null, ["en", "fr"])).toBe("en");
  });

  it("points at the API's PNG, keeping the version", () => {
    expect(cardApiPath({ kind: "event", slug: "paid-jazz-night-2pxql" }, "ar", "2026-11-19T22:03:30.843Z")).toBe(
      "/v1/share-cards/events/paid-jazz-night-2pxql.png?lang=ar&v=2026-11-19T22%3A03%3A30.843Z",
    );
    expect(cardApiPath({ kind: "event", slug: "my party" }, "zh-Hans", null)).toBe("/v1/share-cards/events/my%20party.png?lang=zh-Hans");
    expect(cardApiPath({ kind: "site" }, "fr", null)).toBe("/v1/share-cards/site.png?lang=fr");
    // The pseudo-language is drawn in English.
    expect(cardApiPath({ kind: "site" }, "en-XA", "1")).toBe("/v1/share-cards/site.png?lang=en&v=1");
  });

  it("refuses slugs that could leave the cards' path", () => {
    expect(cardApiPath({ kind: "event", slug: "" }, "en", null)).toBeNull();
    expect(cardApiPath({ kind: "event", slug: "../../v1/admin" }, "en", null)).toBeNull();
    expect(cardApiPath({ kind: "event", slug: "a?b" }, "en", null)).toBeNull();
    expect(cardApiPath({ kind: "event", slug: "x".repeat(201) }, "en", null)).toBeNull();
  });
});
