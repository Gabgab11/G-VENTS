import type { SupabaseServerClient } from "@/lib/supabase/server";

export type PageTier = { id: string; name: string; price_minor: number; quantity: number | null; sold: number };
export type PageQuestion = { id: string; label: string; kind: string; options: string[]; required: boolean };

export type EventPageData = {
  event: {
    id: string;
    title: string;
    slug: string;
    category: string;
    description: string | null;
    starts_at: string;
    ends_at: string | null;
    timezone: string;
    venue_name: string | null;
    city: string | null;
    country: string | null;
    status: "draft" | "published" | "cancelled";
    visibility: "public" | "private";
    refund_policy: string | null;
    cover_theme: string | null;
    cover_url: string | null;
    registration_open: boolean;
    can_manage: boolean;
  };
  tiers: PageTier[];
  questions: PageQuestion[];
};

// The public event page, for public and private events. Private events are only
// reachable by slug, so the database returns them through this function instead of
// a table read (see get_event_page in supabase/migrations).
export async function getEventPage(supabase: SupabaseServerClient, slug: string): Promise<EventPageData | null> {
  const { data, error } = await supabase.rpc("get_event_page", { p_slug: slug });
  if (error) throw new Error(`Could not load event "${slug}": ${error.message}`);
  return (data as EventPageData | null) ?? null;
}
