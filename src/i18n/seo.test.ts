import { describe, expect, it } from "vitest";
import { languageAlternates } from "./seo";

describe("language alternates (W9, FR-24.2)", () => {
  const site = "https://gventz.com";
  it("lists each switched-on language and English as x-default", () => {
    expect(languageAlternates("/e/afro-night", "fr", ["en", "fr", "zh-Hans", "pt"], site)).toEqual({
      canonical: "https://gventz.com/fr/e/afro-night",
      languages: {
        en: "https://gventz.com/e/afro-night",
        fr: "https://gventz.com/fr/e/afro-night",
        "zh-Hans": "https://gventz.com/zh/e/afro-night",
        "pt-BR": "https://gventz.com/pt/e/afro-night",
        "x-default": "https://gventz.com/e/afro-night",
      },
    });
  });

  it("handles the home page, and only English when nothing else is on", () => {
    expect(languageAlternates("/", "en", ["en"], site)).toEqual({ canonical: "https://gventz.com", languages: { en: "https://gventz.com", "x-default": "https://gventz.com" } });
    expect(languageAlternates("/", "ar", ["en", "ar"], site).canonical).toBe("https://gventz.com/ar");
  });
});
