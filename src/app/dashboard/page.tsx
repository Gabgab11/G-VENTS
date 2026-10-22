import Link from "next/link";
import { requireUser } from "@/lib/auth";
import ThemeStage from "@/components/ThemeStage";
import EventRow, { type DashEvent } from "./EventRow";
import ThemePanel from "./ThemePanel";
import SignOutButton from "@/components/SignOutButton";
import { getDashboardTheme } from "./getTheme";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { supabase, user } = await requireUser("/dashboard");
  const { deleted } = await searchParams;

  // One query: each event with its confirmed-registration count embedded.
  const [theme, { data: events, error }] = await Promise.all([
    getDashboardTheme(supabase, user.id),
    supabase
      .from("events")
      .select("id, title, slug, status, visibility, show_attendee_count, starts_at, timezone, registrations(count)")
      .eq("owner_id", user.id)
      .eq("registrations.status", "confirmed")
      .order("starts_at", { ascending: false }),
  ]);
  if (error) throw new Error(`Could not load your events: ${error.message}`);

  const rows: DashEvent[] = (events ?? []).map(({ registrations, ...e }) => ({
    ...e,
    going: (registrations as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
  }));

  return (
    <main className="wrap page wide stage-content">
      <ThemeStage theme={theme} />
      <div className="back-row spread">
        <Link href="/" className="back-link">← Home</Link>
        <SignOutButton />
      </div>
      <div className="spread">
        <div>
          <div className="eyebrow">Organizer</div>
          <h1>Your events</h1>
        </div>
        <Link href="/events/new" className="btn-white">+ Create event</Link>
      </div>
      <p className="muted">Manage registrations, guests, and announcements. Private events open only by link.</p>

      {deleted === "1" && <p className="ok" role="status">Event deleted.</p>}

      <ThemePanel current={theme} />

      {rows.length === 0 && <p className="muted">You haven&apos;t created any events yet.</p>}
      <div className="dash-list">
        {rows.map((e) => <EventRow key={e.id} event={e} />)}
      </div>
    </main>
  );
}
