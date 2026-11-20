import { describe, expect, it } from "vitest";
import { cardApiPath, cardLanguage, movedCardPath } from "./share-card-path";

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

  it("points at a host's profile card, and refuses handles that could leave the path", () => {
    expect(cardApiPath({ kind: "host", handle: "ada-events" }, "fr", "k3x")).toBe("/v1/share-cards/hosts/ada-events.png?lang=fr&v=k3x");
    expect(cardApiPath({ kind: "host", handle: "@Ada" }, "en", null)).toBe("/v1/share-cards/hosts/%40Ada.png?lang=en");
    for (const bad of ["", "../admin", "a/b", "a.png", "x".repeat(41), "a?b"]) expect(cardApiPath({ kind: "host", handle: bad }, "en", null), bad).toBeNull();
  });

  it("follows a moved profile card to the new handle's address, keeping the query", () => {
    expect(movedCardPath("/v1/share-cards/hosts/new-name.png?lang=fr&v=1", "/v1/share-cards/hosts/old-name.png?lang=fr", "?v=1&lang=fr")).toBe("/api/og/h/new-name?v=1&lang=fr");
    expect(movedCardPath("https://api.gventz.com/v1/share-cards/hosts/new-name.png", "/v1/share-cards/hosts/old-name.png?lang=fr", "")).toBe("/api/og/h/new-name");
    // The API answers with a Location relative to the card asked for.
    expect(movedCardPath("new-name.png?lang=fr&v=1", "/v1/share-cards/hosts/old-name.png?lang=fr", "?v=1&lang=fr")).toBe("/api/og/h/new-name?v=1&lang=fr");
    expect(movedCardPath("/v1/admin", "/v1/share-cards/hosts/old-name.png?lang=fr", "")).toBeNull();
    expect(movedCardPath("https://evil.example/v1/share-cards/hosts/x/../../y.png", "/v1/share-cards/hosts/old-name.png?lang=fr", "")).toBeNull();
    expect(movedCardPath(null, "/v1/share-cards/hosts/old-name.png?lang=fr", "")).toBeNull();
  });
});
