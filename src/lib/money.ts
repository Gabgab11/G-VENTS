// Money on the website (M5). Amounts are integer minor units (kobo, pesewas, cents) plus an ISO 4217
// currency, never floats: the only conversions are whole units typed by a host → minor units, and
// minor units → text for display. Pure, so server and client components can both use it.

/** The currency's number of decimals (NGN 2, JPY 0), from Intl; 2 when unknown. */
export function minorDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

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

/** Integer minor units → "₦2,500.00", using the currency's own number of decimals. */
export function formatMinor(amountMinor: number, currency: string): string {
  try {
    const fmt = new Intl.NumberFormat("en-NG", { style: "currency", currency });
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
    return fmt.format(amountMinor / 10 ** digits);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
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
