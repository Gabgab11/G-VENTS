import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Locale } from "./languages";
import { resolveLanguage } from "./resolve";
import { chosenLanguageRedirect, isPublicPath, localizedPath, splitPrefix } from "./routing";

const ON: Locale[] = ["en", "fr", "zh-Hans", "ar"];

describe("routing (W2, D72, FR-24)", () => {
  it("knows the public pages, with or without a language prefix", () => {
    for (const p of ["/", "/discover", "/discover/music", "/e/afro-night", "/t/ABC123", "/pricing", "/help", "/terms", "/privacy", "/refunds", "/fr", "/fr/e/afro-night", "/e/afro-night/tickets", "/zh/e/afro-night/tickets", "/zh/discover", "/ar/t/X"]) expect(isPublicPath(p), p).toBe(true);
    for (const p of ["/dashboard", "/sign-in", "/events/new", "/admin", "/host/settings/security", "/orders/1", "/api/session", "/e/x/edit", "/fr/dashboard", "/english", "/host", "/host/events/new", "/host/payouts"]) expect(isPublicPath(p), p).toBe(false);
  });

  it("moves public pages between languages and leaves the rest alone", () => {
    expect(localizedPath("/e/afro-night", "fr")).toBe("/fr/e/afro-night");
    expect(localizedPath("/fr/e/afro-night", "zh-Hans")).toBe("/zh/e/afro-night");
    expect(localizedPath("/ar/e/afro-night", "en")).toBe("/e/afro-night");
    expect(localizedPath("/", "ar")).toBe("/ar");
    expect(localizedPath("/fr", "en")).toBe("/");
    expect(localizedPath("/dashboard", "fr")).toBe("/dashboard");
    expect(splitPrefix("/zh/e/x")).toEqual({ lang: "zh-Hans", rest: "/e/x" });
    expect(splitPrefix("/en/e/x")).toEqual({ lang: null, rest: "/en/e/x" });
  });

  it("round-trips any public page through every language (PBT)", () => {
    const page = fc.constantFrom("/", "/discover", "/e/afro-night", "/t/XYZ", "/pricing", "/terms");
    const lang = fc.constantFrom<Locale>("en", "es", "fr", "de", "zh-Hans", "pt", "ar");
    fc.assert(fc.property(page, lang, lang, (p, a, b) => {
      expect(localizedPath(localizedPath(localizedPath(p, a), b), "en")).toBe(p);
    }));
  });
});

describe("resolveLanguage (W3, FR-23)", () => {
  const r = (pathname: string, cookie: string | null, acceptLanguage: string | null) => resolveLanguage({ pathname, cookie, acceptLanguage }, ON);
  it("the address wins on public pages, then the cookie, then the browser, then English", () => {
    expect(r("/fr/e/x", "ar", "zh")).toBe("fr");
    expect(r("/dashboard", "ar", "fr")).toBe("ar");
    expect(r("/dashboard", null, "fr-CA,fr;q=0.9")).toBe("fr");
    expect(r("/dashboard", "de", "es")).toBe("en"); // de and es switched off
    expect(r("/e/x", null, null)).toBe("en");
  });

  it("admin follows the chosen language too (one layout for every signed-in page; admin's own text is English)", () => {
    expect(r("/admin", "fr", "fr")).toBe("fr");
    expect(r("/admin/orders", "ar", null)).toBe("ar");
  });

  it("always answers a switched-on language (PBT)", () => {
    fc.assert(fc.property(fc.string(), fc.option(fc.string()), fc.option(fc.string()), (p, c, a) => {
      expect(ON).toContain(r("/" + p, c, a));
    }));
  });
});

describe("chosen language holds across pages (user request 2026-11-15)", () => {
  const ON: Locale[] = ["en", "fr", "ar"];
  it("sends a visitor who chose a language to that language's version of public pages", () => {
    expect(chosenLanguageRedirect("/discover", "fr", ON)).toBe("/fr/discover");
    expect(chosenLanguageRedirect("/", "ar", ON)).toBe("/ar");
    expect(chosenLanguageRedirect("/e/afro-night", "fr", ON)).toBe("/fr/e/afro-night");
  });
  it("does nothing without a choice, for English, switched-off languages, prefixed or non-public pages", () => {
    for (const [path, cookie] of [["/discover", null], ["/discover", "en"], ["/discover", "de"], ["/fr/discover", "ar"], ["/dashboard", "fr"], ["/discover", "xx"]] as const) {
      expect(chosenLanguageRedirect(path, cookie, ON), `${path} ${cookie}`).toBeNull();
    }
  });
});
