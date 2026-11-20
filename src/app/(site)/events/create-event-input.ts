import type { components } from "@/lib/api/schema";
import { isCategory } from "@/lib/categories";
import { checkbox, field } from "@/lib/forms";
import { isThemeKey } from "@/lib/themes";
import { MAPS_URL_HINT_KEY, MAPS_URL_MAX, isGoogleMapsUrl } from "@/lib/maps-url";
import { wholeUnitsToMinor } from "@/lib/money";
import { createTranslator } from "next-intl";
import createEventEn from "../../../../messages/en/createEvent.json";
import sharedEn from "../../../../messages/en/shared.json";

export type CreateEventBody = components["schemas"]["CreateEventDto"];

const MAX_TIERS = 20;
const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

function coordinate(value: string, limit: number): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/** "2026-12-05" + "18:00" → "2026-12-05T18:00" (the API takes local wall-clock times). */
function local(date: string, time: string): string | null {
  return DATE.test(date) && TIME.test(time) ? `${date}T${time}` : null;
}

/** The host may sell paid tickets, in this currency (their payout country's, business rules PR3). */
export type PaidSetup = { currency: string } | null;

/** A message function at the catalogue root (next-intl's `getTranslations()`, narrowed to what this needs). */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

const english = createTranslator({ locale: "en", messages: { createEvent: createEventEn, shared: sharedEn } });
/** The English messages, for callers that don't pass the reader's translator. */
const ENGLISH: Translate = (key, values) => english(key as never, values as never);
const V = "createEvent.validation";

/** A typed price that isn't empty or zero ("0", "0,000"): the host means a paid ticket. */
function isPriced(raw: string): boolean {
  const compact = raw.trim().replace(/[,\s]/g, "");
  return compact !== "" && !/^0+$/.test(compact);
}

/** The form has at least one paid ticket type (so the action checks whether the host may sell). */
export function hasPaidPrice(formData: FormData): boolean {
  return formData.getAll("tier_price").some((p) => isPriced(String(p)));
}

/**
 * The create-event form → the API's CreateEventDto (U6a step 3). Checks only what the form itself
 * must get right; the API enforces every event rule and answers with a message for users.
 * Prices are typed in whole units and sent as minor units in the host's payout currency (M5);
 * without `paid` any price is refused, never quietly saved as free (Change 2, D64).
 * Messages are in English unless `t` (the reader's root translator) is given.
 */
export function createEventBody(formData: FormData, paid: PaidSetup = null, t: Translate = ENGLISH): CreateEventBody | { error: string } {
  const title = field(formData, "title", 140);
  const category = field(formData, "category");
  if (title.length < 3) return { error: t(`${V}.title`) };
  if (!isCategory(category)) return { error: t(`${V}.category`) };

  const startsAt = local(field(formData, "date"), field(formData, "time"));
  if (!startsAt) return { error: t(`${V}.start`) };
  const endDate = field(formData, "end_date");
  const endTime = field(formData, "end_time");
  // End is required too, and must come after the start (same-format local times compare as strings).
  const endsAt = local(endDate, endTime);
  if (!endsAt) return { error: t(`${V}.end`) };
  if (endsAt <= startsAt) return { error: t(`${V}.endAfterStart`) };

  const timeZone = field(formData, "time_zone", 64);
  const location = locationInput(formData, t);
  if ("error" in location) return location;
  if (location.kind === "online" && !timeZone) return { error: t(`${V}.timeZone`) };

  const names = formData.getAll("tier_name").map(String);
  const quantities = formData.getAll("tier_qty").map(String);
  const prices = formData.getAll("tier_price").map(String);
  const ticketTypes: CreateEventBody["ticketTypes"] = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i]!.trim().slice(0, 80);
    if (!name) continue;
    const raw = (quantities[i] ?? "").trim();
    const quantity = raw === "" ? null : Number(raw);
    if (quantity !== null && (!Number.isInteger(quantity) || quantity <= 0)) return { error: t(`${V}.quantity`, { name }) };
    const price = prices[i] ?? "";
    let priceMinor = 0;
    if (isPriced(price)) {
      if (!paid) return { error: t(`${V}.notPaid`) };
      const minor = wholeUnitsToMinor(price, paid.currency);
      if (minor === null) return { error: t(`${V}.price`, { name, currency: paid.currency }) };
      priceMinor = minor;
    }
    ticketTypes.push({ name, priceMinor, groupSize: 1, ...(priceMinor > 0 && paid ? { currency: paid.currency } : {}), ...(quantity !== null ? { quantity } : {}) });
  }
  if (ticketTypes.length === 0) return { error: t(`${V}.noTickets`) };
  if (ticketTypes.length > MAX_TIERS) return { error: t(`${V}.maxTickets`, { max: MAX_TIERS }) };

  const limit = Number(field(formData, "per_buyer_limit") || "10");
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) return { error: t(`${V}.perBuyer`) };

  const theme = field(formData, "cover_theme");
  const description = field(formData, "description");
  const refundPolicy = field(formData, "refund_policy", 2000);
  return {
    title,
    category,
    startsAt,
    endsAt,
    ...(timeZone ? { timeZone } : {}),
    location,
    ticketTypes,
    ...(description ? { description } : {}),
    ...(refundPolicy ? { refundPolicy } : {}),
    visibility: field(formData, "visibility") === "private" ? "private" : "public",
    showAttendeeCount: checkbox(formData, "show_attendee_count"),
    requireApproval: checkbox(formData, "require_approval"),
    coverTheme: (isThemeKey(theme) ? theme : "minimal") as CreateEventBody["coverTheme"],
    perBuyerLimit: limit,
    publish: field(formData, "intent") === "publish",
    // Who pays the fees on paid tickets (FE4/FE5); host_absorbs unless the host chose otherwise.
    feeChoice: field(formData, "fee_choice") === "guest_pays" ? "guest_pays" : "host_absorbs",
  };
}

/**
 * The venue part of the form (create and the dashboard's venue form): online, or a country with
 * an optional region and venue. Place details only count when they came together with the venue.
 */
export function locationInput(formData: FormData, t: Translate = ENGLISH): CreateEventBody["location"] | { error: string } {
  if (checkbox(formData, "is_online")) return { kind: "online" };
  const countryCode = field(formData, "country_code", 2).toUpperCase();
  if (!countryCode) return { error: t(`${V}.country`) };
  const venueName = field(formData, "venue", 300);
  const placeId = field(formData, "place_id", 300);
  const lat = coordinate(field(formData, "lat", 40), 90);
  const lng = coordinate(field(formData, "lng", 40), 180);
  const place = venueName && PLACE_ID.test(placeId) && lat !== null && lng !== null ? { placeId, lat, lng } : undefined;
  const region = field(formData, "region", 120);
  const city = place ? field(formData, "city", 120) : "";
  const address = place ? field(formData, "address", 300) : "";
  const mapsUrl = field(formData, "maps_url", MAPS_URL_MAX + 1);
  if (mapsUrl && !isGoogleMapsUrl(mapsUrl)) return { error: t(MAPS_URL_HINT_KEY) };
  return {
    kind: "venue",
    venueName,
    countryCode,
    ...(region ? { region } : {}),
    ...(city ? { city } : {}),
    ...(address ? { address } : {}),
    ...(place ? { place } : {}),
    ...(mapsUrl ? { mapsUrl } : {}),
  };
}
