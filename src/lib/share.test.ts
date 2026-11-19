import { describe, expect, it } from "vitest";
import { shareCardPath, shareUrls, withRef } from "./share";

describe("shareUrls", () => {
  const urls = shareUrls("https://g-ventz.com/fr/e/fête?ref=share", "Fête & co");

  it("encodes the link and title for each network", () => {
    expect(urls.whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent("Fête & co https://g-ventz.com/fr/e/fête?ref=share")}`);
    expect(urls.x).toBe("https://twitter.com/intent/tweet?text=F%C3%AAte%20%26%20co&url=https%3A%2F%2Fg-ventz.com%2Ffr%2Fe%2Ff%C3%AAte%3Fref%3Dshare");
    expect(urls.facebook).toBe("https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fg-ventz.com%2Ffr%2Fe%2Ff%C3%AAte%3Fref%3Dshare");
    expect(urls.email.startsWith("mailto:?subject=F%C3%AAte%20%26%20co&body=")).toBe(true);
    expect(decodeURIComponent(urls.email.split("body=")[1]!)).toBe("Fête & co\n\nhttps://g-ventz.com/fr/e/fête?ref=share");
  });

  it("never lets the title break out of its parameter", () => {
    const { x } = shareUrls("https://a.test/e/x", "a&url=https://evil.test#");
    const params = new URL(x).searchParams;
    expect(params.get("url")).toBe("https://a.test/e/x");
    expect(params.get("text")).toBe("a&url=https://evil.test#");
  });
});

describe("withRef", () => {
  it("adds ref=share to an absolute link", () => {
    expect(withRef("https://g-ventz.com/e/party")).toBe("https://g-ventz.com/e/party?ref=share");
  });
  it("keeps other parameters and the hash, and replaces an existing ref", () => {
    expect(withRef("https://g-ventz.com/e/party?a=1&ref=old#tickets")).toBe("https://g-ventz.com/e/party?a=1&ref=share#tickets");
  });
  it("works on a relative path", () => {
    expect(withRef("/fr/e/party?x=y")).toBe("/fr/e/party?x=y&ref=share");
  });
});

describe("shareCardPath", () => {
  it("versions the card by updatedAt and carries the language", () => {
    expect(shareCardPath("my party", "2026-11-20T10:00:00.000Z", "fr")).toBe("/api/og/e/my%20party?v=2026-11-20T10%3A00%3A00.000Z&lang=fr");
  });
});
