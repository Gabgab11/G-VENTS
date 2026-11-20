// Discount codes in the Promote tab (Change 4 chunk 5, FR-33). The API checks every rule again;
// these only read the host's form into the API's body, in integer minor units and the event's own
// time zone, and say which field is wrong. Pure, so server and client both use it (and it's tested).
import { zonedTimeToUtc } from "@/lib/dates";
import { percentToBps, bpsToPercent, wholeUnitsToMinor, minorToWholeUnits } from "@/lib/money";
import { intlLocale, safeZone } from "@/lib/format";
import type { Locale } from "@/i18n/languages";
import type { components } from "@/lib/api/schema";

export type DiscountCode = components["schemas"]["DiscountCodeDto"];
export type CreateBody = components["schemas"]["CreateDiscountCodeDto"];
export type UpdateBody = components["schemas"]["UpdateDiscountCodeDto"];

export const DISCOUNT_KINDS = ["percent", "fixed", "free"] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

/** Which field a problem belongs to, and its message id under dashboard.promote.errors. */
export type DiscountError = { field: "code" | "value" | "maxUses" | "startsAt" | "endsAt" | "ticketTypes"; error: string };

/** What the dialog sends. Times are wall-clock "YYYY-MM-DDTHH:mm" in the event's zone, or "". */
export type DiscountInput = {
  code: string;
  kind: string;
  value: string;
  maxUses: string;
  startsAt: string;
  endsAt: string;
  /** Empty = every paid ticket type. */
  ticketTypeIds: string[];
};

const CODE = /^[A-Z0-9_-]{3,32}$/;

/** A code as hosts type it → upper case, trimmed; null unless 3–32 of A–Z, 0–9, - and _. */
export function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return CODE.test(code) ? code : null;
}

/**
 * The value the API stores: percent in basis points (1–100 %, up to two decimals), fixed in minor
 * units of the event's currency (typed in whole units), free 0. Null when it isn't valid.
 */
export function discountValue(kind: DiscountKind, raw: string, currency: string): number | null {
  if (kind === "free") return 0;
  if (kind === "percent") {
    const bps = percentToBps(raw.replace(",", "."));
    return bps !== null && bps >= 100 ? bps : null;
  }
  const minor = wholeUnitsToMinor(raw, currency);
  return minor !== null && minor > 0 ? minor : null;
}

/** The stored value as the dialog shows it ("12.5" percent, "500" whole units, "" for free). */
export function valueText(code: Pick<DiscountCode, "kind" | "value">, currency: string): string {
  if (code.kind === "percent") return bpsToPercent(code.value);
  if (code.kind === "fixed") return minorToWholeUnits(code.value, currency);
  return "";
}

/** Basis points as a percentage in the reader's language ("12.5 %", "12,5 %"); display only. */
export function percentLabel(bps: number, lang: Locale): string {
  return new Intl.NumberFormat(intlLocale(lang), { style: "percent", maximumFractionDigits: 2 }).format(bps / 10_000);
}

/** An instant → "YYYY-MM-DDTHH:mm" on the event's wall clock, for a datetime-local input. */
export function zonedInput(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone(timeZone), hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** "YYYY-MM-DDTHH:mm" in the event's zone → ISO instant; "" → null; undefined when not a time. */
export function zonedToIso(local: string, timeZone: string): string | null | undefined {
  const value = local.trim();
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value);
  if (!m) return undefined;
  const date = zonedTimeToUtc(m[1]!, m[2]!, safeZone(timeZone));
  return date ? date.toISOString() : undefined;
}

/** "" → null (unlimited); a whole number from 1 → that number; anything else → undefined. */
export function parseMaxUses(raw: string): number | null | undefined {
  const value = raw.trim();
  if (!value) return null;
  if (!/^\d{1,7}$/.test(value)) return undefined;
  const n = Number(value);
  return n >= 1 ? n : undefined;
}

type Context = { currency: string; timeZone: string; paidTypeIds: readonly string[] };

type Common = { maxUses: number | null; startsAt: string | null; endsAt: string | null; ticketTypeIds: string[] };

function readCommon(input: DiscountInput, ctx: Context, minUses = 1): Common | DiscountError {
  const maxUses = parseMaxUses(input.maxUses);
  if (maxUses === undefined || (maxUses !== null && maxUses < minUses)) return { field: "maxUses", error: "maxUses" };
  const startsAt = zonedToIso(input.startsAt, ctx.timeZone);
  if (startsAt === undefined) return { field: "startsAt", error: "time" };
  const endsAt = zonedToIso(input.endsAt, ctx.timeZone);
  if (endsAt === undefined) return { field: "endsAt", error: "time" };
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return { field: "endsAt", error: "window" };
  const ticketTypeIds = [...new Set(input.ticketTypeIds)];
  if (ticketTypeIds.some((id) => !ctx.paidTypeIds.includes(id))) return { field: "ticketTypes", error: "ticketTypes" };
  // Every paid type chosen means "all of them", which also covers types added later.
  return { maxUses, startsAt, endsAt, ticketTypeIds: ticketTypeIds.length === ctx.paidTypeIds.length ? [] : ticketTypeIds };
}

const isError = (x: unknown): x is DiscountError => typeof x === "object" && x !== null && "error" in x;

/** A new code's body, or the first problem. */
export function createBody(input: DiscountInput, ctx: Context): { ok: true; body: CreateBody } | ({ ok: false } & DiscountError) {
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, field: "code", error: "code" };
  const kind = DISCOUNT_KINDS.find((k) => k === input.kind);
  if (!kind) return { ok: false, field: "value", error: "kind" };
  const value = discountValue(kind, input.value, ctx.currency);
  if (value === null) return { ok: false, field: "value", error: kind === "percent" ? "percent" : "fixed" };
  const common = readCommon(input, ctx);
  if (isError(common)) return { ok: false, ...common };
  return { ok: true, body: { code, kind, ...(kind === "free" ? {} : { value }), ...common, paused: false } };
}

/**
 * The changes to an existing code. Once used (`locked`), only the limit (not below the uses) and
 * the end can change; pausing has its own action.
 */
export function updateBody(input: DiscountInput, current: DiscountCode, ctx: Context): { ok: true; body: UpdateBody } | ({ ok: false } & DiscountError) {
  const common = readCommon(
    current.locked ? { ...input, startsAt: zonedInput(current.startsAt, ctx.timeZone), ticketTypeIds: current.ticketTypeIds } : input,
    ctx,
    Math.max(1, current.uses),
  );
  if (isError(common)) return { ok: false, ...common };
  if (current.locked) return { ok: true, body: { maxUses: common.maxUses, endsAt: common.endsAt } };
  const kind = DISCOUNT_KINDS.find((k) => k === input.kind);
  if (!kind) return { ok: false, field: "value", error: "kind" };
  const value = discountValue(kind, input.value, ctx.currency);
  if (value === null) return { ok: false, field: "value", error: kind === "percent" ? "percent" : "fixed" };
  return { ok: true, body: { kind, ...(kind === "free" ? {} : { value }), ...common } };
}

/** The address a code's share link opens: the event page in the page's language, with `?code=`. */
export function shareUrl(origin: string, eventPath: string, code: string): string {
  return `${origin}${eventPath}?code=${encodeURIComponent(code)}`;
}
