import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { LANGUAGES, LANGUAGE_INFO, dirOf, enabledLanguages, fromAcceptLanguage, fromPrefix, isEnabled, isLanguage, prefixOf, type Locale } from "./languages";

const ALL = [...LANGUAGES, "en-XA"] as Locale[];

describe("languages (W1, D68, FR-23.5)", () => {
  it("accepts exactly the seven codes", () => {
    for (const l of LANGUAGES) expect(isLanguage(l)).toBe(true);
    for (const bad of ["EN", "zh", "zh-hans", "pt-BR", "en-US", "", "en-XA", 1, null]) expect(isLanguage(bad)).toBe(false);
  });

  it("round-trips URL prefixes, and English has none (PBT)", () => {
    fc.assert(fc.property(fc.constantFrom(...ALL), (l) => { expect(fromPrefix(prefixOf(l))).toBe(l); }));
    expect(prefixOf("en")).toBe("");
    expect(prefixOf("zh-Hans")).toBe("zh");
    fc.assert(fc.property(fc.string(), (s) => {
      const l = fromPrefix(s);
      expect(l === null || LANGUAGE_INFO[l].prefix === s).toBe(true);
    }));
  });

  it("only Arabic is right to left", () => {
    expect(ALL.filter((l) => dirOf(l) === "rtl")).toEqual(["ar"]);
  });

  it("switches languages on by setting; English always, the pseudo-language never in production", () => {
    expect(enabledLanguages(undefined, true)).toEqual(["en"]);
    expect(enabledLanguages("en", true)).toEqual(["en"]);
    expect(enabledLanguages("ar, fr,xx,en-XA", true)).toEqual(["en", "fr", "ar"]);
    expect(enabledLanguages("ar,fr,en-XA", false)).toEqual(["en", "fr", "ar", "en-XA"]);
    expect(isEnabled("fr", ["en"])).toBe(false);
  });

  it("picks the best switched-on language from Accept-Language", () => {
    const on: Locale[] = ["en", "fr", "zh-Hans", "pt", "ar"];
    expect(fromAcceptLanguage("fr-CA,fr;q=0.9,en;q=0.8", on)).toBe("fr");
    expect(fromAcceptLanguage("de-DE,de;q=0.9,ar;q=0.5", on)).toBe("ar");
    expect(fromAcceptLanguage("zh-CN,zh;q=0.9", on)).toBe("zh-Hans");
    expect(fromAcceptLanguage("pt-PT", on)).toBe("pt");
    expect(fromAcceptLanguage("en;q=0.1, fr;q=0.8", on)).toBe("fr");
    expect(fromAcceptLanguage("de", on)).toBeNull();
    expect(fromAcceptLanguage("fr", ["en"])).toBeNull();
    expect(fromAcceptLanguage("", on)).toBeNull();
    fc.assert(fc.property(fc.string(), (h) => {
      const l = fromAcceptLanguage(h, on);
      expect(l === null || on.includes(l)).toBe(true);
    }));
  });
});
