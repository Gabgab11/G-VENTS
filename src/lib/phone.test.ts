import { describe, expect, it } from "vitest";
import { dialCode, phoneCountryOptions, splitPhone, toE164 } from "./phone";

describe("toE164 (4b)", () => {
  it("adds the country code and drops one trunk 0", () => {
    expect(toE164("NG", "0803 123 4567")).toBe("+2348031234567");
    expect(toE164("NG", "803-123-4567")).toBe("+2348031234567");
    expect(toE164("GH", "024 123 4567")).toBe("+233241234567");
    expect(toE164("KE", "0712 345678")).toBe("+254712345678");
    expect(toE164("GB", "07700 900123")).toBe("+447700900123");
    expect(toE164("US", "(415) 555-0123")).toBe("+14155550123");
    expect(toE164("ZA", "082 123 4567")).toBe("+27821234567");
  });

  it("keeps Italy's leading 0", () => {
    expect(toE164("IT", "06 1234 5678")).toBe("+390612345678");
  });

  it("a number typed with + or 00 keeps its own country", () => {
    expect(toE164("NG", "+44 7700 900123")).toBe("+447700900123");
    expect(toE164("NG", "0044 7700 900123")).toBe("+447700900123");
  });

  it("refuses what can't be a number", () => {
    expect(toE164("NG", "")).toBeNull();
    expect(toE164("NG", "call me")).toBeNull();
    expect(toE164("NG", "123")).toBeNull();
    expect(toE164("XX", "08031234567")).toBeNull();
    expect(toE164("NG", "+0123456789")).toBeNull();
    expect(toE164("NG", "1234567890123456789")).toBeNull();
  });
});

describe("splitPhone", () => {
  it("prefers the event's country when its code fits, else the longest code", () => {
    expect(splitPhone("+2348031234567", "GH")).toEqual({ country: "NG", national: "8031234567" });
    expect(splitPhone("+14165550123", "CA")).toEqual({ country: "CA", national: "4165550123" });
    expect(splitPhone("+14155550123", null)).toEqual({ country: "US", national: "4155550123" });
    expect(splitPhone("+12425550123", null)).toEqual({ country: "BS", national: "5550123" });
    expect(splitPhone("+447700900123")).toEqual({ country: "GB", national: "7700900123" });
  });

  it("nothing for values that aren't E.164", () => {
    expect(splitPhone(null)).toBeNull();
    expect(splitPhone("08031234567")).toBeNull();
  });

  it("round-trips with toE164", () => {
    const split = splitPhone("+254712345678", "KE")!;
    expect(toE164(split.country, split.national)).toBe("+254712345678");
  });
});

describe("country options", () => {
  it("dial codes and localised, sorted names", () => {
    expect(dialCode("ng")).toBe("+234");
    expect(dialCode("XX")).toBeNull();
    const options = phoneCountryOptions("en");
    expect(options.find((o) => o.value === "NG")?.label).toBe("Nigeria (⁦+234⁩)");
    expect(options.length).toBeGreaterThan(200);
    expect(phoneCountryOptions("fr").find((o) => o.value === "DE")?.label).toContain("Allemagne");
  });
});
