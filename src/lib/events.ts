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
};

// Fallback sample events, used until the database has published events.
export const SAMPLE_EVENTS: EventCard[] = [
  { id: "s1", title: "Night of Worship", slug: "night-of-worship", category: "Faith", starts_at: "2026-11-07T18:00:00Z", venue_name: "Grace Community Church", city: "Lagos", country: "NG" },
  { id: "s2", title: "Kingdom Leaders Summit", slug: "kingdom-leaders-summit", category: "Conferences", starts_at: "2026-12-05T09:00:00Z", venue_name: "Landmark Centre", city: "Lagos", country: "NG" },
  { id: "s3", title: "Lagos Tech Meetup", slug: "lagos-tech-meetup", category: "Tech", starts_at: "2026-11-14T17:30:00Z", venue_name: "Yaba", city: "Lagos", country: "NG" },
];

export async function getFeaturedEvents(limit = 6): Promise<{ events: EventCard[]; live: boolean }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("events")
      .select("id, title, slug, category, starts_at, venue_name, city, country")
      .eq("status", "published")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(limit);

    if (error || !data || data.length === 0) return { events: SAMPLE_EVENTS, live: false };
    return { events: data as EventCard[], live: true };
  } catch {
    return { events: SAMPLE_EVENTS, live: false };
  }
}
