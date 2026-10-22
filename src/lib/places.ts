// Google Places (New) for the venue search on the event form.
// Runs on the server only: the browser talks to /api/places/*, never to Google,
// so GOOGLE_MAPS_API_KEY is never sent to visitors.
//
// Billing: each search is an Autocomplete (New) request; picking a result makes
// one Place Details (New) request. Both carry the same session token, so Google
// bills the whole search-and-pick as one session.

import { fold } from "@/lib/locations";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places/";
const TIMEOUT_MS = 6000;

export type Suggestion = { placeId: string; main: string; secondary: string };

export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string;
  city: string;
  countryCode: string;
  lat: number | null;
  lng: number | null;
};

export class PlacesError extends Error {
  readonly code: "not_configured" | "unavailable";
  constructor(code: "not_configured" | "unavailable", message: string) {
    super(message);
    this.code = code;
  }
}

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new PlacesError("not_configured", "GOOGLE_MAPS_API_KEY is not set");
  return key;
}

export function placesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

async function google(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      throw new PlacesError("unavailable", `Google Places ${res.status}: ${body}`);
    }
    return await res.json();
  } catch (error) {
    if (error instanceof PlacesError) throw error;
    throw new PlacesError("unavailable", `Google Places request failed: ${String(error)}`);
  } finally {
    clearTimeout(timer);
  }
}

type AutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
    };
  }[];
};

// Suggestions limited to the chosen country. When a state/region is chosen,
// it is added to the search text and matching results are moved to the top.
export async function autocomplete(
  query: string,
  countryCode: string,
  region: string,
  sessionToken: string,
): Promise<Suggestion[]> {
  const key = apiKey();
  const input = region && !fold(query).includes(fold(region)) ? `${query}, ${region}` : query;

  const data = (await google(AUTOCOMPLETE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({
      input,
      includedRegionCodes: [countryCode.toLowerCase()],
      regionCode: countryCode.toLowerCase(),
      languageCode: "en",
      sessionToken,
    }),
  })) as AutocompleteResponse;

  const list: Suggestion[] = [];
  for (const s of data.suggestions ?? []) {
    const p = s.placePrediction;
    if (!p?.placeId) continue;
    list.push({
      placeId: p.placeId,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    });
  }

  if (!region) return list;
  const r = fold(region);
  const inRegion = (s: Suggestion) => fold(`${s.main} ${s.secondary}`).includes(r);
  return [...list.filter(inRegion), ...list.filter((s) => !inRegion(s))];
}

type DetailsResponse = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
};

export async function placeDetails(placeId: string, sessionToken: string): Promise<PlaceDetails> {
  const key = apiKey();
  const url = `${DETAILS_URL}${encodeURIComponent(placeId)}?languageCode=en&sessionToken=${encodeURIComponent(sessionToken)}`;
  const data = (await google(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location,addressComponents",
    },
  })) as DetailsResponse;

  const parts = data.addressComponents ?? [];
  const part = (type: string) => parts.find((c) => c.types?.includes(type));
  const city = part("locality") ?? part("postal_town") ?? part("administrative_area_level_2") ?? part("sublocality");
  const lat = data.location?.latitude;
  const lng = data.location?.longitude;

  return {
    placeId: data.id ?? placeId,
    name: data.displayName?.text ?? "",
    address: data.formattedAddress ?? "",
    city: city?.longText ?? "",
    countryCode: (part("country")?.shortText ?? "").toUpperCase(),
    lat: typeof lat === "number" ? lat : null,
    lng: typeof lng === "number" ? lng : null,
  };
}

// A small per-user limit so a signed-in account can't run up the Google bill.
// Kept in memory per server instance, which is enough to stop runaway scripts.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const hits = new Map<string, number[]>();

export function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}
