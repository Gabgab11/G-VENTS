import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import en from "../../messages/en/shared.json";
import fr from "../../messages/fr/shared.json";
import { priceLabel } from "@/lib/price-label";
import {
  TEXT_WIDTH,
  TITLE_MAX_LINES,
  TITLE_SIZES,
  bidiPieces,
  cardCacheControl,
  cardDateLine,
  cardLanguage,
  cardPlace,
  cardPrice,
  dataUrl,
  fitTitle,
  flyerType,
  needsArabic,
  wrapLines,
} from "./og-card";

const tEn = createTranslator({ locale: "en", messages: { shared: en }, namespace: "shared" });
const tFr = createTranslator({ locale: "fr", messages: { shared: fr }, namespace: "shared" });

describe("share card text (D81)", () => {
  it("uses the lang parameter only when it is a switched-on language", () => {
    expect(cardLanguage("fr", ["en", "fr"])).toBe("fr");
    expect(cardLanguage("de", ["en", "fr"])).toBe("en");
    expect(cardLanguage("FR", ["en", "fr"])).toBe("en");
    expect(cardLanguage("../../etc", ["en", "fr"])).toBe("en");
    expect(cardLanguage(null, ["en", "fr"])).toBe("en");
  });

  it("caches versioned cards for a year and the rest for an hour", () => {
    expect(cardCacheControl("2026-11-19T22:03:30.843Z")).toBe("public, max-age=31536000, immutable");
    expect(cardCacheControl(null)).toBe("public, max-age=3600");
    expect(cardCacheControl("")).toBe("public, max-age=3600");
  });

  it("writes the date in the event's time zone and the page's language", () => {
    // 18:00 UTC is 19:00 in Lagos and 13:00 in New York.
    expect(cardDateLine("2026-11-21T18:00:00Z", "Africa/Lagos", "en")).toMatch(/21 November 2026.*19:00/);
    expect(cardDateLine("2026-11-21T18:00:00Z", "America/New_York", "en")).toMatch(/21 November 2026.*13:00/);
    expect(cardDateLine("2026-11-21T18:00:00Z", "Africa/Lagos", "fr")).toMatch(/samedi 21 novembre 2026.*19:00/);
    // Late evening in Lagos is already the next day in Tokyo.
    expect(cardDateLine("2026-11-21T22:30:00Z", "Asia/Tokyo", "en")).toMatch(/22 November/);
  });

  it("shows the city, else the venue and country, or Online", () => {
    expect(cardPlace({ kind: "venue", city: "Lagos", venueName: "Terra Kulture", country: "Nigeria" }, "Online")).toBe("Lagos");
    expect(cardPlace({ kind: "venue", city: null, venueName: "Terra Kulture", country: "Nigeria" }, "Online")).toBe("Terra Kulture · Nigeria");
    expect(cardPlace({ kind: "online" }, "En ligne")).toBe("En ligne");
  });

  it("labels the price Free or From the lowest price, in the page's language", () => {
    const types = [
      { priceMinor: 750000, currency: "NGN", remaining: 10 },
      { priceMinor: 500000, currency: "NGN", remaining: null },
    ];
    expect(priceLabel(cardPrice(types), "en", tEn)).toBe("From ₦5,000");
    expect(priceLabel(cardPrice(types), "fr", tFr)).toMatch(/^À partir de 5\s000\sNGN$/u);
    expect(priceLabel(cardPrice([{ priceMinor: 0, currency: "NGN" }]), "en", tEn)).toBe("Free");
    expect(priceLabel(cardPrice([]), "en", tEn)).toBe("Free");
  });

  it("never calls a sold-out paid event Free", () => {
    const soldOut = [
      { priceMinor: 500000, currency: "NGN", remaining: 0 },
      { priceMinor: 900000, currency: "NGN", remaining: 0 },
    ];
    expect(cardPrice(soldOut)).toEqual({ minor: 500000, currency: "NGN" });
    // With a free type still listed, the sold-out paid ones don't count.
    expect(cardPrice([...soldOut, { priceMinor: 0, currency: "NGN", remaining: 5 }])).toBeNull();
    // On sale beats sold out, even when dearer.
    expect(cardPrice([{ priceMinor: 100, currency: "NGN", remaining: 0 }, { priceMinor: 900, currency: "NGN", remaining: 1 }])).toEqual({ minor: 900, currency: "NGN" });
  });

  it("keeps short titles at the largest size", () => {
    expect(fitTitle("Paid Jazz Night")).toEqual({ size: TITLE_SIZES[0], text: "Paid Jazz Night", lines: 1 });
  });

  it("shrinks longer titles until they fit in three lines", () => {
    const title = "The Annual Lagos Highlife and Afrobeat Festival: Closing Night";
    const fit = fitTitle(title);
    expect(fit.size).toBeLessThan(TITLE_SIZES[0]);
    expect(fit.text).toBe(title);
    expect(wrapLines(title, fit.size).length).toBeLessThanOrEqual(TITLE_MAX_LINES);
    // and it is the largest size that fits
    const bigger = TITLE_SIZES[TITLE_SIZES.indexOf(fit.size as (typeof TITLE_SIZES)[number]) - 1]!;
    expect(wrapLines(title, bigger).length).toBeGreaterThan(TITLE_MAX_LINES);
  });

  it("cuts titles too long for three lines at the smallest size, with an ellipsis", () => {
    const title = Array.from({ length: 40 }, (_, i) => `Word${i}`).join(" ");
    const fit = fitTitle(title);
    const smallest = TITLE_SIZES[TITLE_SIZES.length - 1];
    expect(fit.size).toBe(smallest);
    expect(fit.text.endsWith("…")).toBe(true);
    expect(fit.text.length).toBeLessThan(title.length);
    expect(wrapLines(fit.text, smallest).length).toBeLessThanOrEqual(TITLE_MAX_LINES);
  });

  it("breaks a word or a CJK run that is wider than the line", () => {
    const lines = wrapLines("拉各斯爵士乐之夜拉各斯爵士乐之夜", 76);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("拉各斯爵士乐之夜拉各斯爵士乐之夜");
    for (const line of wrapLines("Supercalifragilisticexpialidociousness", 76, TEXT_WIDTH)) expect(line.length).toBeGreaterThan(0);
  });

  it("knows when Arabic glyphs are needed", () => {
    expect(needsArabic("Paid Jazz Night", null)).toBe(false);
    expect(needsArabic("Paid", "حفلة الجاز")).toBe(true);
  });

  it("splits Arabic text into pieces laid out right to left, keeping Latin runs whole", () => {
    expect(bidiPieces("Paid Jazz Night")).toEqual({ rtl: false, pieces: ["Paid Jazz Night"] });
    // Intl puts a right-to-left mark in Arabic prices: dropped, it would show as a glyph.
    expect(bidiPieces("ابتداءً من ‏5,000.00 NGN")).toEqual({ rtl: true, pieces: ["ابتداءً", "من", "5,000.00 NGN"] });
    expect(bidiPieces("يستضيفها Ada Lovelace")).toEqual({ rtl: true, pieces: ["يستضيفها", "Ada Lovelace"] });
    expect(bidiPieces("حفلة · الجاز")).toEqual({ rtl: true, pieces: ["حفلة ·", "الجاز"] });
    // An English paragraph with an Arabic name keeps the Arabic words together.
    expect(bidiPieces("Hosted by نادي الجاز")).toEqual({ rtl: false, pieces: ["Hosted", "by", "نادي الجاز"] });
  });

  it("draws only JPEG and PNG flyers", () => {
    expect(flyerType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
    expect(flyerType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    // RIFF....WEBP
    expect(flyerType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBeNull();
    expect(flyerType(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(flyerType(new Uint8Array([]))).toBeNull();
  });

  it("makes data URLs from the flyer's bytes", () => {
    expect(dataUrl(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg")).toBe("data:image/jpeg;base64,/9j/");
    const big = new Uint8Array(100_000).fill(65);
    expect(dataUrl(big, "image/png")).toBe(`data:image/png;base64,${Buffer.from(big).toString("base64")}`);
  });
});
