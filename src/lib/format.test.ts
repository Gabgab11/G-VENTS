import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { LANGUAGES } from "@/i18n/languages";
import { decimalString, formatDateTime, formatMoney, formatRange, formatRelative, countryLabel, zoneLabel } from "./format";

const AT = "2026-11-14T17:00:00Z"; // 18:00 in Lagos

describe("format (W5, FR-25)", () => {
  it("keeps today's English formats", () => {
    expect(formatDateTime(AT, "Africa/Lagos", "en")).toBe("Sat 14 Nov, 18:00");
    expect(formatMoney(250000, "NGN", "en")).toBe("₦2,500.00");
    expect(formatMoney(1500, "JPY", "en")).toBe("JP¥1,500");
    expect(formatRange(AT, "2026-11-14T22:00:00Z", "Africa/Lagos", "en")).toBe("18:00 – 23:00");
  });

  it("formats in the reader's language, in the event's zone", () => {
    expect(formatDateTime(AT, "Africa/Lagos", "fr")).toMatch(/sam\. 14 nov\./);
    expect(formatDateTime(AT, "Africa/Lagos", "fr")).toContain("18:00");
    expect(formatMoney(250000, "NGN", "fr")).toMatch(/^2\s500,00\s(NGN|₦)$/);
    expect(formatMoney(250000, "NGN", "de")).toMatch(/^2\.500,00\s(NGN|₦)$/);
    expect(formatRelative("2026-11-17T17:00:00Z", new Date(AT), "fr")).toBe("dans 3 jours");
    expect(countryLabel("DE", "fr")).toBe("Allemagne");
    expect(zoneLabel("Africa/Lagos", "fr", new Date(AT))).toMatch(/^Lagos · /);
    expect(formatDateTime("not a date", "Africa/Lagos", "en")).toBe("");
    expect(formatDateTime(AT, "Not/AZone", "en")).toBe("Sat 14 Nov, 18:00");
  });

  it("decimal strings are exact", () => {
    expect(decimalString(556000, 2)).toBe("5560.00");
    expect(decimalString(5, 2)).toBe("0.05");
    expect(decimalString(-5, 2)).toBe("-0.05");
    expect(decimalString(1500, 0)).toBe("1500");
    expect(() => decimalString(1.5, 2)).toThrow();
  });

  it("never changes the amount: the digits shown are the minor units, in every language (PBT)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99_999_999_999 }), fc.constantFrom(...LANGUAGES), fc.constantFrom("NGN", "GHS", "KES", "USD", "EUR"), (minor, lang, currency) => {
        const shown = formatMoney(minor, currency, lang);
        // Normalise any digit system (Arabic-Indic too) to ASCII, then keep the digits only.
        const ascii = shown.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
        expect(BigInt(ascii.replace(/\D/g, "") || "0")).toBe(BigInt(minor));
      }),
      { numRuns: 300 },
    );
  });
});
