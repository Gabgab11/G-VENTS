// Money on the website (M5). Amounts are integer minor units (kobo, pesewas, cents) plus an ISO 4217
// currency, never floats: the only conversions are whole units typed by a host → minor units, and
// minor units → text for display. Pure, so server and client components can both use it.
import { decimalString, formatMoney, minorDigits } from "./format";

export { minorDigits } from "./format";

/**
 * A price typed in whole units ("5000", "5,000", " 5 000 ") → minor units (500000 for NGN).
 * Hosts price paid tickets in whole units (the API rounds guest totals to whole units too), so
 * decimals, signs and anything else are refused with null. 0 stays 0 (a free ticket).
 */
export function wholeUnitsToMinor(input: string, currency: string, maxWhole = 100_000_000): number | null {
  const cleaned = input.trim().replace(/[,\s]/g, "");
  if (!/^\d{1,12}$/.test(cleaned)) return null;
  const whole = Number(cleaned);
  if (!Number.isSafeInteger(whole) || whole > maxWhole) return null;
  return whole * 10 ** minorDigits(currency);
}

/** Minor units → whole units as text for an input ("500000" NGN → "5000"); "" when not whole. */
export function minorToWholeUnits(amountMinor: number, currency: string): string {
  const factor = 10 ** minorDigits(currency);
  return Number.isInteger(amountMinor) && amountMinor % factor === 0 ? String(amountMinor / factor) : "";
}

/** Integer minor units → "₦2,500.00", using the currency's own number of decimals (English; see format.ts for other languages). */
export function formatMinor(amountMinor: number, currency: string): string {
  return formatMoney(amountMinor, currency, "en");
}

/** The currency's symbol as the site shows it ("₦", "GH₵", "KSh", "R"); the code when unknown. */
export function currencySymbol(currency: string): string {
  try {
    const part = new Intl.NumberFormat("en-NG", { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency");
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}

/** "7.5" → 750 basis points; up to two decimals, 0 to 100. Null otherwise. String maths, no floats. */
export function percentToBps(input: string): number | null {
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const bps = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return bps <= 10_000 ? bps : null;
}

/** 750 → "7.5" (for showing and pre-filling a rate). */
export function bpsToPercent(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const frac = String(bps % 100).padStart(2, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

/**
 * An amount typed in the currency's main unit, with up to its own number of decimals
 * ("100.50" NGN → 10050, "1500" UGX → 1500, "1500.5" UGX → null). Commas and spaces are dropped;
 * signs, exponents and extra decimals are refused with null. String maths, no floats.
 */
export function majorToMinor(input: string, currency: string, maxMajor = 1_000_000_000): number | null {
  const digits = minorDigits(currency);
  const m = /^(\d{1,12})(?:\.(\d+))?$/.exec(input.trim().replace(/[,\s]/g, ""));
  if (!m) return null;
  const frac = m[2] ?? "";
  if (frac.length > digits) return null;
  const whole = Number(m[1]);
  if (whole > maxMajor) return null;
  const minor = whole * 10 ** digits + Number(frac.padEnd(digits, "0") || "0");
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Minor units → the main unit as typed in a form, without trailing zeros (10050 NGN → "100.5", 1500 UGX → "1500"). */
export function minorToMajor(amountMinor: number, currency: string): string {
  const s = decimalString(amountMinor, minorDigits(currency));
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/** A provider's charge schedule (PS14), integer minor units of one currency and basis points. */
export type ChargeSchedule = { percentBps: number; fixedMinor: number; waiveFixedBelow: number; capMinor: number | null };

/**
 * The provider's charge on an amount, as the API estimates it:
 * min(cap, ceil(amount × percentBps / 10000) + fixed), the fixed part waived below `waiveFixedBelow`.
 */
export function providerCharge(amountMinor: number, s: ChargeSchedule): number {
  if (amountMinor <= 0) return 0;
  const percent = Math.ceil((amountMinor * s.percentBps) / 10_000);
  const fixed = amountMinor < s.waiveFixedBelow ? 0 : s.fixedMinor;
  const charge = percent + fixed;
  return s.capMinor === null ? charge : Math.min(s.capMinor, charge);
}
