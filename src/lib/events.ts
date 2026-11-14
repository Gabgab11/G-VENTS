import "server-only";

import { api, data } from "@/lib/api/server";
import type { Category } from "@/lib/categories";

export type EventCard = {
  id: string;
  title: string;
  slug: string;
  category: string;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  venue_name: string | null;
  is_online: boolean;
  city: string | null;
  country: string | null;
  cover_theme: string | null;
  cover_url: string | null;
};

/**
 * Public, published, upcoming events from gventz-api, optionally one category. Anonymous and cached
 * for a minute, so the home page stays static. An API failure throws, so the page's error boundary
 * shows it instead of passing an outage off as "no events".
 */
export async function getFeaturedEvents(limit = 6, category?: Category): Promise<EventCard[]> {
  const page = data(
    await (await api({ anonymous: true, revalidate: 60 })).GET("/v1/events/featured", {
      params: { query: { limit, ...(category ? { category } : {}) } },
    }),
  );
  return page.items.map((e) => ({
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
  }));
}
