import type { components } from "@/lib/api/schema";
import { isCategory } from "@/lib/categories";
import { checkbox, field } from "@/lib/forms";
import { isThemeKey } from "@/lib/themes";

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

/**
 * The create-event form → the API's CreateEventDto (U6a step 3). Checks only what the form itself
 * must get right; the API enforces every event rule and answers with a message for users.
 */
export function createEventBody(formData: FormData): CreateEventBody | { error: string } {
  const title = field(formData, "title", 140);
  const category = field(formData, "category");
  if (title.length < 3) return { error: "Event name must be 3 to 140 characters." };
  if (!isCategory(category)) return { error: "Choose a category." };

  const startsAt = local(field(formData, "date"), field(formData, "time"));
  if (!startsAt) return { error: "Add a start date and time." };
  const endDate = field(formData, "end_date");
  const endTime = field(formData, "end_time");
  let endsAt: string | null = null;
  if (endDate || endTime) {
    endsAt = local(endDate, endTime);
    if (!endsAt) return { error: "Add both an end date and an end time, or leave both empty." };
  }

  const timeZone = field(formData, "time_zone", 64);
  const location = locationInput(formData);
  if ("error" in location) return location;
  if (location.kind === "online" && !timeZone) return { error: "Choose the event's time zone." };

  const names = formData.getAll("tier_name").map(String);
  const quantities = formData.getAll("tier_qty").map(String);
  const ticketTypes: CreateEventBody["ticketTypes"] = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i]!.trim().slice(0, 80);
    if (!name) continue;
    const raw = (quantities[i] ?? "").trim();
    const quantity = raw === "" ? null : Number(raw);
    if (quantity !== null && (!Number.isInteger(quantity) || quantity <= 0)) return { error: `The quantity for "${name}" must be a whole number above 0.` };
    // Paid tickets arrive with payments (U7); until then every ticket is free.
    ticketTypes.push({ name, priceMinor: 0, ...(quantity !== null ? { quantity } : {}) });
  }
  if (ticketTypes.length === 0) return { error: "Add at least one ticket." };
  if (ticketTypes.length > MAX_TIERS) return { error: `Add at most ${MAX_TIERS} ticket types.` };

  const limit = Number(field(formData, "per_buyer_limit") || "10");
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) return { error: "Choose a limit from 1 to 10 tickets per person." };

  const theme = field(formData, "cover_theme");
  const description = field(formData, "description");
  const refundPolicy = field(formData, "refund_policy", 2000);
  return {
    title,
    category,
    startsAt,
    ...(endsAt ? { endsAt } : {}),
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
  };
}

/**
 * The venue part of the form (create and the dashboard's venue form): online, or a country with
 * an optional region and venue. Place details only count when they came together with the venue.
 */
export function locationInput(formData: FormData): CreateEventBody["location"] | { error: string } {
  if (checkbox(formData, "is_online")) return { kind: "online" };
  const countryCode = field(formData, "country_code", 2).toUpperCase();
  if (!countryCode) return { error: "Choose a country from the list." };
  const venueName = field(formData, "venue", 300);
  const placeId = field(formData, "place_id", 300);
  const lat = coordinate(field(formData, "lat", 40), 90);
  const lng = coordinate(field(formData, "lng", 40), 180);
  const place = venueName && PLACE_ID.test(placeId) && lat !== null && lng !== null ? { placeId, lat, lng } : undefined;
  const region = field(formData, "region", 120);
  const city = place ? field(formData, "city", 120) : "";
  const address = place ? field(formData, "address", 300) : "";
  return {
    kind: "venue",
    venueName,
    countryCode,
    ...(region ? { region } : {}),
    ...(city ? { city } : {}),
    ...(address ? { address } : {}),
    ...(place ? { place } : {}),
  };
}
