import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/categories";

export type EventCard = {
  id: string;
  title: string;
  slug: string;
  category: string;
  starts_at: string;
  timezone: string;
  venue_name: string | null;
  city: string | null;
  country: string | null;
  cover_theme: string | null;
  cover_url: string | null;
};

// Public, published, upcoming events. Optionally limited to one category.
// A database failure throws, so the page's error boundary shows it instead of
// passing an outage off as "no events".
export async function getFeaturedEvents(limit = 6, category?: Category): Promise<EventCard[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("events")
    .select("id, title, slug, category, starts_at, timezone, venue_name, city, country, cover_theme, cover_url")
    .eq("status", "published")
    .eq("visibility", "public")
    .gte("starts_at", new Date().toISOString());
  if (category) query = query.eq("category", category);

  const { data, error } = await query.order("starts_at", { ascending: true }).limit(limit);
  if (error) throw new Error(`Could not load events: ${error.message}`);
  return (data ?? []) as EventCard[];
}
