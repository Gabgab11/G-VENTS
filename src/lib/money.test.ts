import { describe, expect, it } from "vitest";
import { bpsToPercent, currencySymbol, percentToBps, formatMinor, majorToMinor, minorDigits, minorToMajor, minorToWholeUnits, providerCharge, wholeUnitsToMinor } from "./money";
import { formatMoney } from "./format";

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

describe("rates in basis points", () => {
  it("reads a percentage without floats", () => {
    expect(percentToBps("7.5")).toBe(750);
    expect(percentToBps("0")).toBe(0);
    expect(percentToBps("12.25")).toBe(1225);
    expect(percentToBps("100")).toBe(10000);
    for (const bad of ["100.01", "-1", "7.555", "abc", "", "1e2"]) expect(percentToBps(bad), bad).toBeNull();
  });
  it("shows basis points as a percentage", () => {
    expect(bpsToPercent(750)).toBe("7.5");
    expect(bpsToPercent(1225)).toBe("12.25");
    expect(bpsToPercent(0)).toBe("0");
    expect(bpsToPercent(1000)).toBe("10");
  });
});

describe("currencies without a minor unit (Change 5 chunk 4, PS19)", () => {
  it("UGX, RWF, XAF and XOF have 0 decimals, the others 2, as the API says", () => {
    for (const c of ["UGX", "RWF", "XAF", "XOF", "ugx"]) expect(minorDigits(c), c).toBe(0);
    for (const c of ["NGN", "GHS", "KES", "ZAR", "TZS", "ZMW"]) expect(minorDigits(c), c).toBe(2);
  });

  it("formats them without decimals, in every language", () => {
    expect(formatMinor(15000, "UGX")).toMatch(/^UGX\s?15,000$/);
    expect(formatMinor(5000, "XOF")).not.toContain(".");
    expect(formatMoney(5000, "RWF", "fr")).toMatch(/^5\s000\s(RWF|RF)$/);
    expect(formatMoney(250000, "NGN", "en", true)).toBe("₦2,500");
    expect(formatMoney(250050, "NGN", "en", true)).toBe("₦2,500.50");
  });

  it("whole units become minor units by the exponent", () => {
    expect(wholeUnitsToMinor("15000", "UGX")).toBe(15000);
    expect(wholeUnitsToMinor("5000", "XAF")).toBe(5000);
    expect(minorToWholeUnits(15000, "UGX")).toBe("15000");
  });
});

describe("amounts in the main unit with decimals (charge schedules)", () => {
  it("reads up to the currency's decimals", () => {
    expect(majorToMinor("100", "NGN")).toBe(10000);
    expect(majorToMinor("100.5", "NGN")).toBe(10050);
    expect(majorToMinor("2,500.05", "NGN")).toBe(250005);
    expect(majorToMinor("1500", "UGX")).toBe(1500);
    expect(majorToMinor("0", "KES")).toBe(0);
  });
  it("refuses too many decimals, signs and words", () => {
    for (const bad of ["1500.5", "-1", "1e3", "", "abc", "1.2.3"]) expect(majorToMinor(bad, "UGX"), bad).toBeNull();
    expect(majorToMinor("1.005", "NGN")).toBeNull();
  });
  it("goes back without trailing zeros", () => {
    expect(minorToMajor(10000, "NGN")).toBe("100");
    expect(minorToMajor(10050, "NGN")).toBe("100.5");
    expect(minorToMajor(1500, "UGX")).toBe("1500");
    for (const minor of [0, 1, 99, 10050, 123456]) expect(majorToMinor(minorToMajor(minor, "NGN"), "NGN")).toBe(minor);
  });
});

describe("provider charge estimate (PS14)", () => {
  const paystackNg = { percentBps: 150, fixedMinor: 10000, waiveFixedBelow: 250000, capMinor: 200000 };
  it("percentage, fixed part from the threshold, capped", () => {
    expect(providerCharge(1_000_000, paystackNg)).toBe(25000); // ₦10,000 → ₦150 + ₦100
    expect(providerCharge(200_000, paystackNg)).toBe(3000); // under ₦2,500: no fixed part
    expect(providerCharge(100_000_000, paystackNg)).toBe(200000); // capped at ₦2,000
    expect(providerCharge(0, paystackNg)).toBe(0);
  });
  it("rounds the percentage up and has no cap when null", () => {
    expect(providerCharge(1001, { percentBps: 350, fixedMinor: 0, waiveFixedBelow: 0, capMinor: null })).toBe(36);
  });
});
