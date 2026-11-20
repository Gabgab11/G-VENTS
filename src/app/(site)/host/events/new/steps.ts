// The create-event stepper's logic (HA, "Create event"): which form field lives on which step,
// moving between steps, the checks run before Continue, and which step a server error belongs to.
// Pure, so the form, the server action and the tests share it.

import { MAPS_URL_HINT_KEY, isGoogleMapsUrl } from "@/lib/maps-url";
import { parseGroupSize } from "@/lib/group-tickets";

export const STEPS = ["basics", "when", "tickets", "publish"] as const;
export type StepKey = (typeof STEPS)[number];
export const LAST_STEP = STEPS.length - 1;

/** Every submitted field name → its step (0-based). Names are the form's, unchanged from /events/new. */
const FIELD_STEP: Record<string, number> = {
  title: 0, category: 0, description: 0,
  date: 1, time: 1, end_date: 1, end_time: 1, time_zone: 1, is_online: 1,
  country_code: 1, country: 1, region: 1, venue: 1, place_id: 1, address: 1, city: 1, lat: 1, lng: 1, maps_url: 1,
  tier_name: 2, tier_qty: 2, tier_price: 2, tier_desc: 2, tier_group_size: 2, fee_choice: 2, per_buyer_limit: 2,
  flyer: 3, image_pending: 3, cover_theme: 3, visibility: 3, show_attendee_count: 3, require_approval: 3, refund_policy: 3, intent: 3,
};

/** The step holding a field; unknown fields belong to the last step (where the form is sent). */
export function stepOfField(field: string | undefined | null): number {
  return field != null && Object.hasOwn(FIELD_STEP, field) ? FIELD_STEP[field]! : LAST_STEP;
}

export function fieldsOfStep(step: number): string[] {
  return Object.keys(FIELD_STEP).filter((f) => FIELD_STEP[f] === step);
}

export const nextStep = (step: number) => Math.min(step + 1, LAST_STEP);
export const previousStep = (step: number) => Math.max(step - 1, 0);

/** The step indicator lets the host go back to finished steps only (forward means Continue). */
export function canVisit(target: number, current: number): boolean {
  return Number.isInteger(target) && target >= 0 && target < current;
}

/** A failed check: the field to point at and the message (a key at the catalogue root, with values). */
export type StepProblem = { field: string; key: string; values?: Record<string, string | number> };

/** The form's values as the checks need them (read from FormData, so hidden steps count too). */
export type FormValues = { get(name: string): FormDataEntryValue | null; getAll(name: string): FormDataEntryValue[] };

const V = "createEvent.validation";
const str = (v: FormDataEntryValue | null | undefined) => (typeof v === "string" ? v.trim() : "");

/**
 * The client checks before leaving a step (on top of the browser's own constraint validation).
 * They repeat the server's (create-event-input.ts) for what the browser can't see: the hidden date
 * wheels, the country picker, the Maps link and ticket quantities. The server still checks it all.
 */
export function checkStep(step: number, form: FormValues): StepProblem | null {
  if (step === 0) {
    if (str(form.get("title")).length < 3) return { field: "title", key: `${V}.title` };
    return null;
  }
  if (step === 1) {
    const start = str(form.get("date")) && str(form.get("time")) ? `${str(form.get("date"))}T${str(form.get("time"))}` : "";
    const end = str(form.get("end_date")) && str(form.get("end_time")) ? `${str(form.get("end_date"))}T${str(form.get("end_time"))}` : "";
    if (!start) return { field: "date", key: `${V}.start` };
    if (!end) return { field: "end_date", key: `${V}.end` };
    if (end <= start) return { field: "end_date", key: `${V}.endAfterStart` };
    const atVenue = form.get("is_online") === null;
    if (atVenue && !str(form.get("country_code"))) return { field: "country_code", key: `${V}.country` };
    if (atVenue && !str(form.get("venue"))) return { field: "venue", key: `${V}.venue` };
    const maps = str(form.get("maps_url"));
    if (maps && !isGoogleMapsUrl(maps)) return { field: "maps_url", key: MAPS_URL_HINT_KEY };
    return null;
  }
  if (step === 2) {
    const names = form.getAll("tier_name").map(str);
    const quantities = form.getAll("tier_qty").map(str);
    const sizes = form.getAll("tier_group_size").map(str);
    if (!names.some(Boolean)) return { field: "tier_name", key: `${V}.noTickets` };
    for (let i = 0; i < names.length; i++) {
      const q = quantities[i] ?? "";
      if (names[i] && q !== "" && !/^[1-9]\d*$/.test(q)) return { field: "tier_qty", key: `${V}.quantity`, values: { name: names[i]! } };
      if (names[i] && parseGroupSize(sizes[i]) === null) return { field: "tier_group_size", key: `${V}.groupSize`, values: { name: names[i]! } };
    }
    return null;
  }
  return null;
}

/** The first step (in order) whose checks fail, for a submit that skipped ahead; null when all pass. */
export function firstFailingStep(form: FormValues): { step: number; problem: StepProblem } | null {
  for (let step = 0; step <= LAST_STEP; step++) {
    const problem = checkStep(step, form);
    if (problem) return { step, problem };
  }
  return null;
}

/** createEventBody's message keys (createEvent.validation.*, the Maps hint) → the field they're about. */
const KEY_FIELD: Record<string, string> = {
  [`${V}.title`]: "title",
  [`${V}.category`]: "category",
  [`${V}.start`]: "date",
  [`${V}.end`]: "end_date",
  [`${V}.endAfterStart`]: "end_date",
  [`${V}.timeZone`]: "time_zone",
  [`${V}.country`]: "country_code",
  [`${V}.venue`]: "venue",
  [MAPS_URL_HINT_KEY]: "maps_url",
  [`${V}.quantity`]: "tier_qty",
  [`${V}.notPaid`]: "tier_price",
  [`${V}.price`]: "tier_price",
  [`${V}.noTickets`]: "tier_name",
  [`${V}.maxTickets`]: "tier_name",
  [`${V}.groupSize`]: "tier_group_size",
  [`${V}.ticketDescription`]: "tier_desc",
  [`${V}.perBuyer`]: "per_buyer_limit",
};

export function fieldOfMessageKey(key: string | undefined): string | undefined {
  return key && Object.hasOwn(KEY_FIELD, key) ? KEY_FIELD[key] : undefined;
}

/** gventz-api problem codes from POST /v1/events → the form field they're about. */
const CODE_FIELD: Record<string, string> = {
  "event.title_length": "title",
  "event.slug_unavailable": "title",
  "event.category_invalid": "category",
  "event.description_length": "description",
  "event.time_invalid": "date",
  "event.end_before_start": "end_date",
  "event.time_not_in_zone": "date",
  "event.time_zone_required": "time_zone",
  "event.country_invalid": "country_code",
  "event.region_invalid": "region",
  "event.location_invalid": "venue",
  "event.ticket_name_invalid": "tier_name",
  "event.ticket_types_count": "tier_name",
  "event.ticket_quantity_invalid": "tier_qty",
  "event.capacity_invalid": "tier_qty",
  "event.price_invalid": "tier_price",
  "event.currency_invalid": "tier_price",
  "event.currency_mixed": "tier_price",
  "event.currency_not_payout": "tier_price",
  "event.paid_not_allowed": "tier_price",
  "event.paid_tickets_unsupported": "tier_price",
  "event.payout_account_required": "tier_price",
  "event.host_owes_money": "tier_price",
  "event.fees": "fee_choice",
  "event.buyer_limit_invalid": "per_buyer_limit",
  "event.refund_policy_length": "refund_policy",
};

/** The API's field paths (CreateEventDto) → form fields: "location.countryCode", "ticketTypes.0.priceMinor", ... */
const PATH_FIELD: [RegExp, string][] = [
  [/^title/, "title"],
  [/^category/, "category"],
  [/^description/, "description"],
  [/^startsAt/, "date"],
  [/^endsAt/, "end_date"],
  [/^timeZone/, "time_zone"],
  [/^(location\.)?countryCode/, "country_code"],
  [/^(location\.)?venueName/, "venue"],
  [/^location\.region/, "region"],
  [/^location\.mapsUrl/, "maps_url"],
  [/^location/, "venue"],
  [/^ticketTypes.*(price|currency)/i, "tier_price"],
  [/^ticketTypes.*quantity/i, "tier_qty"],
  [/^ticketTypes/, "tier_name"],
  [/^feeChoice/, "fee_choice"],
  [/^perBuyerLimit/, "per_buyer_limit"],
  [/^refundPolicy/, "refund_policy"],
  [/^coverTheme/, "cover_theme"],
  [/^visibility/, "visibility"],
];

/** The form field an API problem is about: a field error's path first, then the problem's code. */
export function fieldOfProblem(problem: { code?: string; errors?: { field: string }[] } | undefined): string | undefined {
  const path = problem?.errors?.[0]?.field;
  if (path) for (const [re, field] of PATH_FIELD) if (re.test(path)) return field;
  return problem?.code && Object.hasOwn(CODE_FIELD, problem.code) ? CODE_FIELD[problem.code] : undefined;
}
