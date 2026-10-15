import Link from "next/link";
import { getFeaturedEvents } from "@/lib/events";

const CATEGORIES = [
  { name: "Music", color: "#f0604f" },
  { name: "Conferences", color: "#f2a33a" },
  { name: "Tech", color: "#6aa8f2" },
  { name: "Faith and worship", color: "#e0438f" },
  { name: "Arts and culture", color: "#9b6cf2" },
  { name: "Food and drink", color: "#e0a03a" },
  { name: "Sports and fitness", color: "#3fb8a8" },
  { name: "Business", color: "#c7d158" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
}

export default async function HomePage() {
  const { events, live } = await getFeaturedEvents(6);

  return (
    <main>
      <header className="topbar">
        <Link href="/" className="wordmark">G<span>-</span>vents</Link>
        <Link href="/sign-in" className="pill">Sign In</Link>
      </header>

      <div className="wrap">
        <section className="hero">
          <div className="hero-photo" role="img" aria-label="Golden mirrored disco balls" />
          <div className="hero-wash" />
          <div className="copy">
            <h1>Events from <span className="grad-text">everywhere</span></h1>
            <p style={{ marginTop: 20 }}>
              Concerts, conferences, meetups, church nights, and everything in between. Create one in minutes and sell tickets to anyone, anywhere.
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
              <Link key={c.name} href={`/discover?category=${encodeURIComponent(c.name)}`} className="cat">
                <span className="dot" style={{ background: c.color }} />
                {c.name}
              </Link>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>Happening soon</h2>
          <div className="events">
            {events.map((e) => (
              <Link key={e.id} href={`/e/${e.slug}`} className="event-card">
                <div className="when">{formatDate(e.starts_at)}</div>
                <div className="title">{e.title}</div>
                <div className="where">
                  {[e.venue_name, e.city, e.country].filter(Boolean).join(" · ")}
                </div>
              </Link>
            ))}
          </div>
          {!live && <p className="notice">Showing sample events until the first real event is published.</p>}
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
