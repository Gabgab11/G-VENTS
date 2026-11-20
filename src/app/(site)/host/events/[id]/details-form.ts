// The Details tab's form → PATCH /v1/events/{id} (UpdateEventDetailsDto). Pure, so the rules are
// tested: only changed fields are sent; ticket types keep the API's locks (a price is fixed once
// it has sales, quantity never below sold, types with sales can't be removed). The API checks
// all of this again and answers with a message to show.
import { isCategory } from "@/lib/categories";
import { decimalString, minorDigits } from "@/lib/format";

export type TicketRowInput = { id: string; name: string; quantity: string; price: string; remove: boolean };

export type DetailsInput = {
  title: string;
  description: string;
  category: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  tickets: TicketRowInput[];
};

export type TicketTypeForPatch = { id: string; name: string; priceMinor: number; currency: string; quantity: number | null; sold: number };

export type EventForPatch = {
  title: string;
  description: string | null;
  category: string;
  startsAtLocal: string;
  endsAtLocal: string | null;
  timeZone: string;
  status: "draft" | "published" | "cancelled";
  counts: { confirmed: number; pending: number; waitlisted: number };
  ticketTypes: TicketTypeForPatch[];
};

export type TicketChange = { id?: string; remove?: boolean; name?: string; priceMinor?: number; quantity?: number | null };

export type DetailsBody = {
  title?: string;
  description?: string | null;
  category?: string;
  startsAt?: string;
  endsAt?: string | null;
  timeZone?: string;
  ticketTypes?: TicketChange[];
};

export const DETAILS_ERRORS = [
  "title_length", "category", "starts_at", "ends_at", "ends_before_start", "time_zone",
  "ticket_name", "ticket_quantity", "ticket_quantity_below_sold", "ticket_price", "ticket_price_locked",
  "ticket_has_sales", "ticket_count",
] as const;
export type DetailsError = (typeof DETAILS_ERRORS)[number];

export type DetailsResult = { ok: true; body: DetailsBody; rescheduled: boolean } | { ok: false; error: DetailsError };

export const MAX_TICKET_TYPES = 20;

/** What the host may change on one ticket type. */
export function ticketLock(t: { sold: number }): { priceLocked: boolean; minQuantity: number; removable: boolean } {
  return { priceLocked: t.sold > 0, minQuantity: Math.max(1, t.sold), removable: t.sold === 0 };
}

/** Integer minor units → the price as typed in the form ("5000", "12.50"). */
export function priceText(minor: number, currency: string): string {
  const s = decimalString(minor, minorDigits(currency));
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/**
 * A typed price → integer minor units, without floats. Accepts "5000", "5,000", "5 000", "12.50"
 * and "12,50" (a comma with at most the currency's decimals after it is a decimal comma).
 * Empty is free (0). Null when it can't be read.
 */
export function parsePrice(raw: string, currency: string): number | null {
  const digits = minorDigits(currency);
  let s = raw.trim().replace(/[\s  _]/g, "");
  if (s === "") return 0;
  if (s.includes(".") && s.includes(",")) s = s.replace(/,/g, "");
  else if (s.includes(",")) {
    const m = /^(\d+),(\d+)$/.exec(s);
    s = m && digits > 0 && m[2]!.length <= digits ? `${m[1]}.${m[2]}` : s.replace(/,(?=\d{3}(\D|$))/g, "");
  }
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return null;
  const frac = m[2] ?? "";
  if (frac.length > digits) return null;
  const minor = Number(`${m[1]}${frac.padEnd(digits, "0")}`);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** A typed quantity: "" is unlimited (null); undefined when it isn't a whole number from 1. */
export function parseQuantity(raw: string): number | null | undefined {
  const s = raw.trim();
  if (s === "") return null;
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  return n >= 1 && Number.isSafeInteger(n) ? n : undefined;
}

const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
/** "2026-12-05T18:00:00" → "2026-12-05T18:00" (what datetime-local inputs use). */
export const localMinute = (s: string | null | undefined) => (s ? s.slice(0, 16) : "");

function validZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return /\//.test(zone) || zone === "UTC";
  } catch {
    return false;
  }
}

/** Guests who would be told about a new date: confirmed, waiting for approval or on the waiting list. */
export function guestCount(e: Pick<EventForPatch, "counts">): number {
  return e.counts.confirmed + e.counts.pending + e.counts.waitlisted;
}

/** Moving a published event that has guests: the form asks first, and the API records it as rescheduled. */
export function isReschedule(e: EventForPatch, input: Pick<DetailsInput, "startsAt" | "endsAt" | "timeZone">): boolean {
  if (e.status !== "published" || guestCount(e) === 0) return false;
  return localMinute(input.startsAt) !== localMinute(e.startsAtLocal)
    || localMinute(input.endsAt) !== localMinute(e.endsAtLocal)
    || (input.timeZone !== "" && input.timeZone !== e.timeZone);
}

/** The PATCH body for what changed, or the first rule the form breaks. */
export function detailsPatch(input: DetailsInput, e: EventForPatch): DetailsResult {
  const body: DetailsBody = {};

  const title = input.title.trim();
  if (title.length < 3 || title.length > 140) return { ok: false, error: "title_length" };
  if (title !== e.title) body.title = title;

  const description = input.description.trim() || null;
  if (description !== (e.description ?? null)) body.description = description;

  if (input.category !== e.category) {
    if (!isCategory(input.category)) return { ok: false, error: "category" };
    body.category = input.category;
  }

  const startsAt = localMinute(input.startsAt.trim());
  const endsAt = localMinute(input.endsAt.trim());
  if (!LOCAL.test(startsAt)) return { ok: false, error: "starts_at" };
  if (endsAt !== "" && !LOCAL.test(endsAt)) return { ok: false, error: "ends_at" };
  if (endsAt !== "" && endsAt <= startsAt) return { ok: false, error: "ends_before_start" };
  const zone = input.timeZone.trim();
  if (zone !== "" && zone !== e.timeZone) {
    if (!validZone(zone)) return { ok: false, error: "time_zone" };
    body.timeZone = zone;
  }
  if (startsAt !== localMinute(e.startsAtLocal)) body.startsAt = startsAt;
  if (endsAt !== localMinute(e.endsAtLocal)) body.endsAt = endsAt === "" ? null : endsAt;

  const currency = e.ticketTypes[0]?.currency ?? "NGN";
  const changes: TicketChange[] = [];
  let kept = 0;
  for (const row of input.tickets) {
    const existing = row.id ? e.ticketTypes.find((t) => t.id === row.id) : undefined;
    if (row.id && !existing) continue; // a type that's gone already; nothing to change
    if (existing && row.remove) {
      if (!ticketLock(existing).removable) return { ok: false, error: "ticket_has_sales" };
      changes.push({ id: existing.id, remove: true });
      continue;
    }
    if (!existing && row.remove) continue; // added then removed in the form
    kept++;
    const name = row.name.trim();
    if (name.length < 1 || name.length > 80) return { ok: false, error: "ticket_name" };
    const quantity = parseQuantity(row.quantity);
    if (quantity === undefined) return { ok: false, error: "ticket_quantity" };

    if (!existing) {
      const priceMinor = parsePrice(row.price, currency);
      if (priceMinor === null) return { ok: false, error: "ticket_price" };
      changes.push({ name, priceMinor, quantity });
      continue;
    }

    const lock = ticketLock(existing);
    if (quantity !== null && quantity < existing.sold) return { ok: false, error: "ticket_quantity_below_sold" };
    const change: TicketChange = { id: existing.id };
    if (name !== existing.name) change.name = name;
    if (quantity !== existing.quantity) change.quantity = quantity;
    const priceMinor = parsePrice(row.price, existing.currency);
    if (priceMinor === null) return { ok: false, error: "ticket_price" };
    if (priceMinor !== existing.priceMinor) {
      if (lock.priceLocked) return { ok: false, error: "ticket_price_locked" };
      change.priceMinor = priceMinor;
    }
    if (Object.keys(change).length > 1) changes.push(change);
  }
  if (kept < 1 || kept > MAX_TICKET_TYPES) return { ok: false, error: "ticket_count" };
  if (changes.length > 0) body.ticketTypes = changes;

  return { ok: true, body, rescheduled: isReschedule(e, { startsAt, endsAt, timeZone: zone }) };
}

/** The form's fields (names used by DetailsForm), read from FormData. */
export function readDetailsForm(fd: { get(name: string): unknown; getAll(name: string): unknown[] }): DetailsInput {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const list = (name: string) => fd.getAll(name).map(str);
  const ids = list("tt_id");
  const names = list("tt_name");
  const quantities = list("tt_quantity");
  const prices = list("tt_price");
  const removes = list("tt_remove");
  return {
    title: str(fd.get("title")).slice(0, 200),
    description: str(fd.get("description")).slice(0, 10000),
    category: str(fd.get("category")),
    startsAt: str(fd.get("starts_at")),
    endsAt: str(fd.get("ends_at")),
    timeZone: str(fd.get("time_zone")),
    tickets: ids.slice(0, 40).map((id, i) => ({
      id,
      name: (names[i] ?? "").slice(0, 200),
      quantity: quantities[i] ?? "",
      price: prices[i] ?? "",
      remove: removes[i] === "1",
    })),
  };
}
