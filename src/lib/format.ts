// Dates, times, numbers and prices in the reader's language (Change 3, FR-25, D75). Amounts stay
// integer minor units plus an ISO 4217 currency and are handed to Intl as an exact decimal string,
// never a float. Times are always shown in the event's own zone. English keeps today's formats
// ("Sat 7 Nov, 18:00", "₦2,500.00"), so English pages don't change.
import type { Locale } from "@/i18n/languages";
import { zoneLabel as englishZoneLabel } from "@/lib/time-zones";

export const DEFAULT_TIMEZONE = "Africa/Lagos";

/** The Intl locale for a language. English dates are British style and money Nigerian style, as before. */
export function intlLocale(lang: Locale, purpose: "date" | "money" | "general" = "general"): string {
  if (lang === "en" || lang === "en-XA") return purpose === "date" ? "en-GB" : purpose === "money" ? "en-NG" : "en";
  if (lang === "pt") return "pt-BR";
  return lang;
}

export const DATE_STYLES = {
  // "Sat 7 Nov, 18:00"
  short: { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" },
  // "7 Nov, 18:00"
  compact: { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" },
  // "Saturday 7 November 2026 at 18:00"
  long: { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateStyle = keyof typeof DATE_STYLES;

/** A usable IANA zone: the given one, or Lagos when it is missing or unknown to Intl. */
export function safeZone(timeZone: string | null | undefined): string {
  const tz = timeZone || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function formatDateTime(iso: string | Date, timeZone: string | null | undefined, lang: Locale, style: DateStyle = "short"): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(intlLocale(lang, "date"), { ...DATE_STYLES[style], timeZone: safeZone(timeZone) });
}

/** "18:00 – 23:00", or "20 Feb 18:00 – 21 Feb 02:00" across days, in the event's zone. */
export function formatRange(startIso: string | Date, endIso: string | Date | null, timeZone: string | null | undefined, lang: Locale): string {
  const tz = safeZone(timeZone);
  const locale = intlLocale(lang, "date");
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...o, timeZone: tz }).format(d);
  const clock = (d: Date) => fmt(d, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const short = (d: Date) => fmt(d, { day: "numeric", month: "short" });
  if (Number.isNaN(start.getTime())) return "";
  if (!end || Number.isNaN(end.getTime())) return clock(start);
  return dayKey(end) === dayKey(start) ? `${clock(start)} – ${clock(end)}` : `${short(start)} ${clock(start)} – ${short(end)} ${clock(end)}`;
}

/** "in 3 days", "dans 3 jours", "قبل يومين": the largest whole unit between now and the moment. */
export function formatRelative(iso: string | Date, now: Date, lang: Locale): string {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return "";
  const seconds = Math.round((at - now.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31_536_000], ["month", 2_592_000], ["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60]];
  const rtf = new Intl.RelativeTimeFormat(intlLocale(lang), { numeric: "auto" });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.trunc(seconds / size), unit);
  }
  return rtf.format(seconds, "second");
}

/** The currency's number of decimals (NGN 2, JPY 0), from Intl; 2 when unknown. */
export function minorDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** Integer minor units → an exact decimal string for Intl: 556000 (2 digits) → "5560.00". */
export function decimalString(minor: number, digits: number): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError("amount must be a safe integer of minor units");
  const sign = minor < 0 ? "-" : "";
  const abs = String(Math.abs(minor)).padStart(digits + 1, "0");
  return digits === 0 ? `${sign}${abs}` : `${sign}${abs.slice(0, -digits)}.${abs.slice(-digits)}`;
}

/**
 * Integer minor units → "₦2,500.00" (English), "2 500,00 NGN" (French), and so on.
 * `compact` drops the decimals of a whole amount ("₦5,000"), for short labels like "From ₦5,000".
 */
export function formatMoney(minor: number, currency: string, lang: Locale, compact = false): string {
  const digits = minorDigits(currency);
  try {
    const whole = digits > 0 && minor % 10 ** digits === 0;
    const fmt = new Intl.NumberFormat(intlLocale(lang, "money"), { style: "currency", currency, ...(compact && whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}) });
    // Intl formats a numeric string exactly (no float in between).
    return fmt.format(decimalString(minor, digits) as unknown as number);
  } catch {
    return `${currency} ${decimalString(Number.isSafeInteger(minor) ? minor : 0, digits)}`;
  }
}

/** A country's name in the reader's language ("NG" → "Nigeria", "Nigéria", "نيجيريا"). */
export function countryLabel(code: string, lang: Locale): string {
  try {
    return new Intl.DisplayNames([intlLocale(lang)], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** "Lagos · West Africa Time (GMT+1)" in English; the zone's name in the reader's language otherwise. */
export function zoneLabel(zone: string, lang: Locale, at: Date = new Date()): string {
  if (lang === "en" || lang === "en-XA") return englishZoneLabel(zone, at);
  const city = (zone.split("/").pop() ?? zone).replace(/_/g, " ");
  const part = (style: "longGeneric" | "shortOffset") => {
    try {
      return new Intl.DateTimeFormat(intlLocale(lang), { timeZone: zone, timeZoneName: style }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "";
    } catch {
      return "";
    }
  };
  const name = part("longGeneric");
  const offset = part("shortOffset");
  return name ? `${city} · ${name}${offset && offset !== name ? ` (${offset})` : ""}` : city;
}
