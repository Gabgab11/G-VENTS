import "server-only";

import { cache } from "react";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";
import type { EventCard } from "@/lib/events";

// The public host profile from gventz-api (Change 4 chunk 4, FR-32).
//
// The generated schema names two different shapes "HostEventsPageDto" (the host's own events list and
// the profile's public page of events), so components["schemas"]["HostProfileDto"]["events"] comes out
// as the wrong one. The profile's events are typed here from the API's hosts module
// (application/dto.ts, HostEventsPageDto and HostEventCardDto) until the API gives them distinct names.

export type HostEventCard = {
  id: string;
  slug: string;
  title: string;
  category: string;
  startsAt: string;
  endsAt: string | null;
  startsAtLocal: string;
  timeZone: string;
  isOnline: boolean;
  venueName: string | null;
  city: string | null;
  country: string | null;
  coverUrl: string | null;
  coverTheme: string;
};

export type HostProfileEvents = {
  tab: "upcoming" | "past";
  items: HostEventCard[];
  nextCursor: string | null;
  upcomingCount: number;
  pastCount: number;
};

export type HostProfile = Omit<components["schemas"]["HostProfileDto"], "events"> & { events: HostProfileEvents };
export type MyHostProfile = components["schemas"]["MyHostProfileDto"];
export type ProfileTab = HostProfileEvents["tab"];

export const profileTab = (value: string | string[] | undefined): ProfileTab => (value === "past" ? "past" : "upcoming");
export const profileCursor = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" && value.length > 0 && value.length <= 512 ? value : undefined;

/** One page of a profile, as the viewer sees it (`following` when signed in). Null: no such handle. */
async function getHostProfile(handle: string, tab: ProfileTab, cursor: string | undefined): Promise<HostProfile | null> {
  if (!handle || handle.length > 100) return null;
  try {
    const result = await (await api()).GET("/v1/hosts/{handle}", { params: { path: { handle }, query: { tab, ...(cursor ? { cursor } : {}) } } });
    return data(result) as unknown as HostProfile;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    // A cursor from an old link the API can't read: show the first page instead of an error.
    if (error instanceof ApiError && error.status === 400 && cursor) return getHostProfile(handle, tab, undefined);
    throw error;
  }
}

/** Once per request: the metadata (404, 308) and the page share one API call. */
export const loadHostProfile = cache(getHostProfile);

/** A profile event as a Discover tile. The profile's events carry no price, so the tile shows none. */
export function asEventCard(e: HostEventCard): EventCard {
  return {
    id: e.id,
    title: e.title,
    slug: e.slug,
    category: e.category,
    starts_at: e.startsAt,
    ends_at: e.endsAt,
    timezone: e.timeZone,
    venue_name: e.venueName,
    is_online: e.isOnline,
    city: e.city,
    country: e.country,
    cover_theme: e.coverTheme,
    cover_url: e.coverUrl,
    min_price_minor: null,
    currency: null,
  };
}
