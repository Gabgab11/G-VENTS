import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import EventRow, { type DashEvent } from "./EventRow";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/dashboard");

  const { data: events } = await supabase
    .from("events")
    .select("id, title, slug, status, visibility, show_attendee_count, starts_at")
    .eq("owner_id", user.id)
    .order("starts_at", { ascending: false });

  const rows: DashEvent[] = await Promise.all(
    (events ?? []).map(async (e) => {
      const { count } = await supabase
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", e.id)
        .eq("status", "confirmed");
      return { ...e, going: count ?? 0 };
    })
  );

  return (
    <main className="wrap page">
      <div className="spread">
        <h1>Your events</h1>
        <Link href="/events/new" className="btn-white">Create event</Link>
      </div>
      <p className="muted">Only you see the registration numbers and the draft list here. Private events are hidden from Discover and open only by link.</p>

      {rows.length === 0 && <p className="muted">You haven&apos;t created any events yet.</p>}
      <div className="dash-list">
        {rows.map((e) => <EventRow key={e.id} event={e} />)}
      </div>
    </main>
  );
}
