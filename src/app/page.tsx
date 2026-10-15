import Link from "next/link";
import Globe from "@/components/Globe";
import { getFeaturedEvents } from "@/lib/events";
import { CATEGORIES, CATEGORY_COLORS } from "@/lib/categories";
import { formatEventDate } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: { user } }, events] = await Promise.all([
    supabase.auth.getUser(),
    getFeaturedEvents(6),
  ]);

  return (
    <main>
      <header className="topbar">
        <Link href="/" className="wordmark">G<span>-</span>vents</Link>
        {user
          ? <Link href="/dashboard" className="pill">Dashboard</Link>
          : <Link href="/sign-in" className="pill">Sign In</Link>}
      </header>

      <div className="wrap">
        <section className="hero">
          <div className="globe-wrap-outer">
            <Globe />
          </div>
          <div className="copy">
            <h1>Events from <span className="grad-text">everywhere</span></h1>
            <p style={{ marginTop: 20 }}>
              Concerts, conferences, meetups, church nights, and everything in between. Create one in minutes and share it with anyone, anywhere.
            </p>
            <div className="actions" style={{ marginTop: 32 }}>
              <Link href="/events/new" className="btn-white">Create Your First Event</Link>
              <Link href="/discover" className="muted">Discover Events</Link>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>Browse by category</h2>
          <div className="cats">
            {CATEGORIES.map((c) => (
              <Link key={c} href={`/discover?category=${encodeURIComponent(c)}`} className="cat">
                <span className="dot" style={{ background: CATEGORY_COLORS[c] }} />
                {c}
              </Link>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>Happening soon</h2>
          {events.length > 0 ? (
            <div className="events">
              {events.map((e) => (
                <Link key={e.id} href={`/e/${e.slug}`} className="event-card">
                  <div className="when">{formatEventDate(e.starts_at, e.timezone)}</div>
                  <div className="title">{e.title}</div>
                  <div className="where">
                    {[e.venue_name, e.city, e.country].filter(Boolean).join(" · ")}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted">No upcoming public events yet. <Link href="/events/new" className="gold">Be the first to create one.</Link></p>
          )}
        </section>

        <section className="closing">
          <h2>Your next <span className="grad-text">gathering</span> starts here.</h2>
          <div className="actions">
            <Link href="/discover" className="btn-ghost">Discover Events</Link>
            <Link href="/events/new" className="btn-white">Create an event</Link>
          </div>
        </section>
      </div>

      <footer>
        <div className="foot-row">
          <Link href="/discover">Discover</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/help">Help</Link>
        </div>
        <div className="foot-legal">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refunds">Refunds</Link>
        </div>
      </footer>
    </main>
  );
}
