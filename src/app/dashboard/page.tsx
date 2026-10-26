import Link from "next/link";
import ColorModeToggle from "@/components/ColorModeToggle";
import { api, data } from "@/lib/api/server";
import { requireUser } from "@/lib/auth";
import ThemeStage from "@/components/ThemeStage";
import EventRow, { type DashEvent } from "./EventRow";
import ThemePanel from "./ThemePanel";
import SignOutButton from "@/components/SignOutButton";
import { getDashboardTheme } from "./getTheme";

// The organizer's events from gventz-api: owned, or where they hold an accepted role.
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ deleted?: string; page?: string }> }) {
  await requireUser("/dashboard");
  const { deleted, page: rawPage } = await searchParams;
  const page = Math.max(1, Math.floor(Number(rawPage) || 1));

  const [theme, list] = await Promise.all([
    getDashboardTheme(),
    (await api()).GET("/v1/me/events", { params: { query: { page, pageSize: 50 } } }).then(data),
  ]);

  const rows: DashEvent[] = list.items.map((e) => ({
    id: e.id,
    title: e.title,
    slug: e.slug,
    status: e.status,
    visibility: e.visibility,
    show_attendee_count: e.showAttendeeCount,
    starts_at: e.startsAt,
    timezone: e.timeZone,
    going: e.confirmedCount,
    role: e.role,
  }));
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <main className="wrap page wide stage-content">
      <ThemeStage theme={theme} />
      <div className="back-row spread">
        <Link href="/" className="back-link">← Home</Link>
        <div className="row-gap"><ColorModeToggle /><SignOutButton /></div>
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

      {pages > 1 && (
        <nav className="spread" aria-label="Event pages">
          {page > 1 ? <Link href={`/dashboard?page=${page - 1}`} className="btn-small">← Previous</Link> : <span />}
          <span className="muted small">Page {page} of {pages}</span>
          {page < pages ? <Link href={`/dashboard?page=${page + 1}`} className="btn-small">Next →</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
