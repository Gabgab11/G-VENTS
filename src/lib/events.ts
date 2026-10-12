import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EventCard = {
  id: string;
  title: string;
  slug: string;
  category: string;
  starts_at: string;
  venue_name: string | null;
  city: string | null;
  country: string | null;
  cover_theme: string | null;
  cover_url: string | null;
};

// Sample events for launch, until real public events are published.
export const SAMPLE_EVENTS: EventCard[] = [
  { id: "s1", title: "Night of Worship", slug: "night-of-worship", category: "Faith and worship", starts_at: "2026-11-07T18:00:00Z", venue_name: "Grace Community Church", city: "Lagos", country: "NG", cover_theme: "night", cover_url: null },
  { id: "s2", title: "Kingdom Leaders Summit", slug: "kingdom-leaders-summit", category: "Conferences", starts_at: "2026-12-05T09:00:00Z", venue_name: "Landmark Centre", city: "Lagos", country: "NG", cover_theme: "ocean", cover_url: null },
  { id: "s3", title: "Lagos Tech Meetup", slug: "lagos-tech-meetup", category: "Tech", starts_at: "2026-11-14T17:30:00Z", venue_name: "Yaba", city: "Lagos", country: "NG", cover_theme: "forest", cover_url: null },
];

// Public, published, upcoming events. Optionally limited to one category.
export async function getFeaturedEvents(limit = 6, category?: string): Promise<{ events: EventCard[]; live: boolean }> {
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("events")
      .select("id, title, slug, category, starts_at, venue_name, city, country, cover_theme, cover_url")
      .eq("status", "published")
      .eq("visibility", "public")
      .gte("starts_at", new Date().toISOString());
    if (category) query = query.eq("category", category);
    const { data, error } = await query.order("starts_at", { ascending: true }).limit(limit);

    if (error || !data) return { events: category ? [] : SAMPLE_EVENTS, live: false };
    if (data.length === 0 && !category) return { events: SAMPLE_EVENTS, live: false };
    return { events: data as EventCard[], live: true };
  } catch {
    return { events: category ? [] : SAMPLE_EVENTS, live: false };
  }
}
