import { describe, expect, it } from "vitest";
import { currencySymbol, formatMinor, minorDigits, minorToWholeUnits, wholeUnitsToMinor } from "./money";

describe("money (integer minor units only)", () => {
  it("knows each currency's decimals", () => {
    expect(minorDigits("NGN")).toBe(2);
    expect(minorDigits("ZAR")).toBe(2);
    expect(minorDigits("JPY")).toBe(0);
    expect(minorDigits("not-a-code")).toBe(2);
  });

  it("turns whole units into minor units", () => {
    expect(wholeUnitsToMinor("5000", "NGN")).toBe(500000);
    expect(wholeUnitsToMinor(" 5,000 ", "NGN")).toBe(500000);
    expect(wholeUnitsToMinor("1 200", "KES")).toBe(120000);
    expect(wholeUnitsToMinor("0", "GHS")).toBe(0);
    expect(wholeUnitsToMinor("700", "JPY")).toBe(700);
  });

  it("refuses decimals, signs, words and huge numbers", () => {
    for (const bad of ["49.99", "-5", "+5", "1e3", "ten", "", " ", "5.", "0x10", "1000000001"]) expect(wholeUnitsToMinor(bad, "NGN"), bad).toBeNull();
  });

  it("goes back to whole units only when exact", () => {
    expect(minorToWholeUnits(500000, "NGN")).toBe("5000");
    expect(minorToWholeUnits(500050, "NGN")).toBe("");
  });

  it("formats with the currency's own decimals and symbol", () => {
    expect(formatMinor(250000, "NGN")).toBe("₦2,500.00");
    expect(formatMinor(4000, "USD")).toContain("40.00");
    expect(currencySymbol("NGN")).toBe("₦");
    expect(currencySymbol("ZZZ")).toBe("ZZZ");
  });
});
