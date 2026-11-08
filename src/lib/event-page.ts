import "server-only";

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
export async function getEventPage(slug: string): Promise<EventPage | null> {
  try {
    return data(await (await api()).GET("/v1/events/by-slug/{slug}", { params: { path: { slug } } }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** "Venue · City · Country", or "Online". */
export function whereText(location: EventPage["location"]): string {
  if (location.kind === "online") return "Online";
  return [location.venueName, location.city, location.country].filter(Boolean).join(" · ");
}
