// Pure helpers for the workspace's Overview tab.

export type SalesDay = { date: string; currency: string; orders: number; grossMinor: number };
export type DayBar = SalesDay & { share: number };

/**
 * The latest `limit` days with sales, per currency, each with its share of that currency's best
 * day (0–100, for the bar's length). Days come newest first from the API and stay that way.
 */
export function dayBars(days: readonly SalesDay[], limit = 14): { currency: string; days: DayBar[] }[] {
  const by = new Map<string, SalesDay[]>();
  for (const d of days) {
    if (d.orders <= 0 && d.grossMinor <= 0) continue;
    const list = by.get(d.currency) ?? [];
    if (list.length < limit) list.push(d);
    by.set(d.currency, list);
  }
  return [...by].map(([currency, list]) => {
    const max = Math.max(...list.map((d) => d.grossMinor), 0);
    return { currency, days: list.map((d) => ({ ...d, share: max > 0 ? Math.round((d.grossMinor / max) * 100) : 0 })) };
  });
}

/** "2026-11-19" (a date in the event's zone) shown as a short day in the reader's language. */
export function dayLabel(date: string, intlLocale: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Intl.DateTimeFormat(intlLocale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}
