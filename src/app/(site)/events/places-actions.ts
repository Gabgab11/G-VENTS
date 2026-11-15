"use server";

import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import { countryReference, type CountryReference } from "@/lib/reference";

// The venue search on the event forms, through gventz-api's Places proxy (U5): the Google key
// lives on the API, which also applies the per-user limits (60 a minute, 1,000 a day).

export type PlacesProblem = "signed_out" | "rate_limited" | "not_configured" | "unavailable" | "bad_request";
export type Suggestion = { placeId: string; main: string; secondary: string };
export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string;
  city: string;
  countryCode: string;
  lat: number | null;
  lng: number | null;
  /** The place's state or region in the API's spelling (the same list the form offers); null if unknown. */
  region: string | null;
  /** IANA time zone at the place; null without coordinates. */
  timeZone: string | null;
};

function problemOf(error: unknown): PlacesProblem {
  if (!(error instanceof ApiError)) return "unavailable";
  if (error.status === 401) return "signed_out";
  if (error.status === 429) return "rate_limited";
  if (error.code === "places.not_configured") return "not_configured";
  if (error.code === "places.bad_request" || error.status === 400) return "bad_request";
  return "unavailable";
}

export async function searchPlaces(q: string, country: string, region: string, session: string): Promise<{ suggestions?: Suggestion[]; error?: PlacesProblem }> {
  try {
    const result = data(
      await (await api()).GET("/v1/places/autocomplete", {
        params: { query: { q: String(q).slice(0, 300), country: String(country).slice(0, 2), session: String(session).slice(0, 64), ...(region ? { region: String(region).slice(0, 300) } : {}) } },
      }),
    );
    return { suggestions: result.suggestions };
  } catch (error) {
    return { error: problemOf(error) };
  }
}

export async function placeDetails(id: string, session: string): Promise<{ place?: PlaceDetails; error?: PlacesProblem }> {
  try {
    const result = data(await (await api()).GET("/v1/places/details", { params: { query: { id: String(id).slice(0, 300), session: String(session).slice(0, 64) } } }));
    return { place: result.place };
  } catch (error) {
    return { error: problemOf(error) };
  }
}

/** A typed venue or address placed on the map: the best match in the country (and region), or null. */
export async function locatePlace(q: string, country: string, region: string): Promise<{ place?: PlaceDetails | null; error?: PlacesProblem }> {
  try {
    const result = data(
      await (await api()).GET("/v1/places/locate", {
        params: { query: { q: String(q).slice(0, 300), country: String(country).slice(0, 2), ...(region ? { region: String(region).slice(0, 300) } : {}) } },
      }),
    );
    return { place: result.place ?? null };
  } catch (error) {
    return { error: problemOf(error) };
  }
}

/** The country's states and time zones for the form (public reference data, cached for a day). */
export async function countryDetails(code: string): Promise<CountryReference | null> {
  try {
    return await countryReference(code);
  } catch (error) {
    console.error(`[reference] country ${String(code).slice(0, 2)}: ${(error as Error).message}`);
    return null;
  }
}
