"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isCategory } from "@/lib/categories";
import { isThemeKey } from "@/lib/themes";
import { DEFAULT_TIMEZONE, zonedTimeToUtc } from "@/lib/dates";
import { checkbox, field } from "@/lib/forms";
import { userMessage } from "@/lib/errors";
import { countryName, isCountryCode, regionsFor } from "@/lib/locations";

export type CreateEventState = { error?: string } | undefined;

const MAX_TIERS = 20;

function makeSlug(title: string) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  // 5 random base-36 characters: enough that slugs can't be guessed or collide in practice.
  const suffix = Array.from(randomBytes(5), (b) => (b % 36).toString(36)).join("");
  return `${base || "event"}-${suffix}`;
}

type Location = {
  venue_name: string;
  address: string;
  city: string;
  region: string;
  country: string;
  country_code: string;
  lat: number | null;
  lng: number | null;
  place_id: string;
};

const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;

function coordinate(value: string, limit: number): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

// Location from the form: Country, State/Region, then the venue. The venue is
// either a Google Places result (with address, coordinates and Place ID) or
// whatever the host typed. Place details are only kept when they come together,
// so a stale Place ID can't be saved next to a hand-typed venue.
function readLocation(formData: FormData): Location | { error: string } {
  const countryCode = field(formData, "country_code", 2).toUpperCase();
  const country = field(formData, "country", 120);
  const region = field(formData, "region", 120);
  const venue = field(formData, "venue", 300);

  if (countryCode && !isCountryCode(countryCode)) return { error: "Choose a country from the list." };
  const regions = countryCode ? regionsFor(countryCode) : null;
  if (regions && region && !regions.regions.includes(region)) {
    return { error: `Choose a ${regions.label.toLowerCase()} from the list.` };
  }

  const placeId = field(formData, "place_id", 300);
  const lat = coordinate(field(formData, "lat", 40), 90);
  const lng = coordinate(field(formData, "lng", 40), 180);
  const hasPlace = PLACE_ID.test(placeId) && venue !== "";

  return {
    venue_name: venue,
    address: hasPlace ? field(formData, "address", 300) : "",
    // Pages show "venue · city · country"; without a Google town, the region fills that spot.
    city: (hasPlace ? field(formData, "city", 120) : "") || region,
    region,
    country: countryName(countryCode) ?? country,
    country_code: countryCode,
    lat: hasPlace && lat !== null && lng !== null ? lat : null,
    lng: hasPlace && lat !== null && lng !== null ? lng : null,
    place_id: hasPlace ? placeId : "",
  };
}

export async function createEvent(_prev: CreateEventState, formData: FormData): Promise<CreateEventState> {
  const { supabase } = await requireUser("/events/new");

  const title = field(formData, "title", 140);
  const category = field(formData, "category");
  const theme = field(formData, "cover_theme");
  const intent = field(formData, "intent") === "publish" ? "publish" : "draft";
  const timezone = DEFAULT_TIMEZONE;

  if (title.length < 3) return { error: "Event name must be 3 to 140 characters." };
  if (!isCategory(category)) return { error: "Choose a category." };

  const date = field(formData, "date");
  const time = field(formData, "time");
  if (!date || !time) return { error: "Add a start date and time." };
  const startsAt = zonedTimeToUtc(date, time, timezone);
  if (!startsAt) return { error: "The start date or time is not valid." };

  let endsAt: Date | null = null;
  const endDate = field(formData, "end_date");
  const endTime = field(formData, "end_time");
  if (endDate || endTime) {
    if (!endDate || !endTime) return { error: "Add both an end date and an end time, or leave both empty." };
    endsAt = zonedTimeToUtc(endDate, endTime, timezone);
    if (!endsAt || endsAt <= startsAt) return { error: "The end must be after the start." };
  }

  const tierNames = formData.getAll("tier_name").map(String);
  const tierQty = formData.getAll("tier_qty").map(String);
  const tiers: { name: string; price_minor: number; quantity: number | null }[] = [];
  for (let i = 0; i < tierNames.length; i++) {
    const name = tierNames[i].trim().slice(0, 80);
    if (!name) continue;
    const qtyRaw = (tierQty[i] ?? "").trim();
    const qty = qtyRaw === "" ? null : Number(qtyRaw);
    if (qty !== null && (!Number.isInteger(qty) || qty <= 0)) return { error: `The quantity for "${name}" must be a whole number above 0.` };
    // Paid tickets are switched off until payments exist, so every ticket is free.
    tiers.push({ name, price_minor: 0, quantity: qty });
  }
  if (tiers.length === 0) return { error: "Add at least one ticket." };
  if (tiers.length > MAX_TIERS) return { error: `Add at most ${MAX_TIERS} ticket types.` };

  const location = readLocation(formData);
  if ("error" in location) return { error: location.error };

  // Event and tickets are written in one transaction, so a failure never leaves half an event.
  const { data: event, error } = await supabase.rpc("create_event_with_tiers", {
    p_event: {
      title,
      slug: makeSlug(title),
      category,
      description: field(formData, "description"),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
      timezone,
      ...location,
      refund_policy: field(formData, "refund_policy", 2000),
      visibility: field(formData, "visibility") === "private" ? "private" : "public",
      show_attendee_count: checkbox(formData, "show_attendee_count"),
      require_approval: checkbox(formData, "require_approval"),
      cover_theme: isThemeKey(theme) ? theme : "minimal",
      status: intent === "publish" ? "published" : "draft",
    },
    p_tiers: tiers,
  });

  if (error || !event) return { error: userMessage(error, "We couldn't save the event. Please try again.") };

  const saved = event as { slug: string };
  redirect(intent === "publish" ? `/e/${saved.slug}` : "/dashboard");
}
