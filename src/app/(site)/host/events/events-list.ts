// Pure helpers for the host's events list (Change 4 chunk 3, HA3): the filter, revenue per
// currency, what each role may do from a row, and the page addresses.

export const EVENT_FILTERS = ["all", "upcoming", "drafts", "past"] as const;
export type EventFilter = (typeof EVENT_FILTERS)[number];

/** The `?filter=` value, or "all" for anything unknown. */
export function filterOf(raw: string | undefined): EventFilter {
  return (EVENT_FILTERS as readonly string[]).includes(raw ?? "") ? (raw as EventFilter) : "all";
}

/** The `?page=` value: a whole number from 1. */
export function pageOf(raw: string | undefined): number {
  return Math.max(1, Math.floor(Number(raw) || 1));
}

/** The list's address for a filter and page; defaults are left out. */
export function listHref(filter: EventFilter, page = 1): string {
  const q = new URLSearchParams();
  if (filter !== "all") q.set("filter", filter);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `/host/events?${s}` : "/host/events";
}

export type GrossLine = { currency: string; grossMinor: number };

/**
 * Gross per currency, added up (integer minor units), in the order currencies first appear.
 * An empty list stays empty: the API sends gross only to roles that may see sales.
 */
export function sumByCurrency(lines: readonly GrossLine[] | null | undefined): GrossLine[] {
  const totals = new Map<string, number>();
  for (const l of lines ?? []) {
    if (!Number.isSafeInteger(l.grossMinor)) continue;
    totals.set(l.currency, (totals.get(l.currency) ?? 0) + l.grossMinor);
  }
  return [...totals].map(([currency, grossMinor]) => ({ currency, grossMinor }));
}

/** Roles with guests.checkIn (the API decides; this only hides the Scan control). */
export function roleCanCheckIn(role: string): boolean {
  return ["owner", "admin", "editor", "checkin"].includes(role);
}

/** Roles with event.edit. */
export function roleCanEdit(role: string): boolean {
  return ["owner", "admin", "editor"].includes(role);
}

/** "82 / 150" or "82" when unlimited (formatted by the caller's number formatter). */
export function soldText(sold: number, capacity: number | null | undefined, n: (x: number) => string): string {
  return capacity === null || capacity === undefined ? n(sold) : `${n(sold)} / ${n(capacity)}`;
}
