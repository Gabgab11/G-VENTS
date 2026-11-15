// The formatter bound to one language (shared by useFormat and getFormat).
import { countryLabel, formatDateTime, formatMoney, formatRange, formatRelative, zoneLabel, type DateStyle } from "@/lib/format";
import type { Locale } from "./languages";

export function bindFormat(lang: Locale) {
  return {
    lang,
    dateTime: (iso: string | Date, timeZone: string | null | undefined, style: DateStyle = "short") => formatDateTime(iso, timeZone, lang, style),
    range: (start: string | Date, end: string | Date | null, timeZone: string | null | undefined) => formatRange(start, end, timeZone, lang),
    relative: (iso: string | Date, now: Date = new Date()) => formatRelative(iso, now, lang),
    money: (minor: number, currency: string) => formatMoney(minor, currency, lang),
    country: (code: string) => countryLabel(code, lang),
    zone: (zone: string) => zoneLabel(zone, lang),
  };
}
