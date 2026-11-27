import "server-only";

import { cache } from "react";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import type { components } from "@/lib/api/schema";

export type EventPage = components["schemas"]["EventPageDto"];
export type PageTicketType = components["schemas"]["TicketTypeViewDto"];
export type PageQuestion = components["schemas"]["QuestionViewDto"];

/**
 * The public event page from gventz-api (U6a). Published events for everyone; drafts and cancelled
 * events only for the event's team, which the API decides from the viewer's token. Null = not found.
 */
export async function getEventPage(slug: string, r?: string | null): Promise<EventPage | null> {
  try {
    // Change 6: `?r=<token>` resolves a segment registration link; the API scopes the page's tiers and
    // questions to it and reports whether an access code is needed. An unknown token falls back to default.
    return data(await (await api()).GET("/v1/events/by-slug/{slug}", { params: { path: { slug }, ...(r ? { query: { r } } : {}) } }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * The same, once per request: generateMetadata and the page share one API call (React `cache`). The
 * metadata calls notFound() for an unknown slug, which resolves before the page streams, so it is a 404.
 * The registration-link token `r` is part of the cache key, so both call sites must pass the same value.
 */
export const loadEventPage = cache(getEventPage);

/** "Venue · City · Country", or "Online". */
export function whereText(location: EventPage["location"]): string {
  if (location.kind === "online") return "Online";
  return [location.venueName, location.city, location.country].filter(Boolean).join(" · ");
}
