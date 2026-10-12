import Link from "next/link";
import { Suspense } from "react";
import { getFeaturedEvents } from "@/lib/events";
import { themeBackground } from "@/lib/themes";
import { CATEGORIES } from "@/lib/categories";
import ElsewhereEvents from "@/components/ElsewhereEvents";
import CategoryBrowser from "@/components/CategoryBrowser";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos",
  });
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const sp = await searchParams;
  const category = CATEGORIES.find((c) => c === sp.category);
  const { events, live } = await getFeaturedEvents(12, category);

  return (
    <main className="wrap page wide">
      <div className="section-head">
        <h1>Discover</h1>
        <p className="muted">Events on G-vents{category ? "" : ", and what's happening elsewhere"}.</p>
      </div>

      <CategoryBrowser categories={CATEGORIES} active={category} />

      <section>
        <div className="cat-head">
          <h2>{category ? `${category} on G-vents` : "On G-vents"}</h2>
          {category && <Link href="/discover" className="gold small">Show all</Link>}
        </div>
        {live && events.length > 0 ? (
          <div className="ext-grid">
            {events.map((e) => (
              <Link key={e.id} href={`/e/${e.slug}`} className="event-card">
                <div className="event-card-cover" style={{ background: themeBackground(e.cover_theme) }} />
                <span className="source-tag">{e.category}</span>
                <b className="ext-title">{e.title}</b>
                <span className="muted small">{fmt(e.starts_at)}{e.city ? ` · ${e.city}` : ""}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted">{category ? `No upcoming ${category.toLowerCase()} events yet.` : "No public G-vents events yet. Hosts can publish one from their dashboard."}</p>
        )}
      </section>

      {!category && (
        <Suspense fallback={<p className="muted small">Loading more events…</p>}>
          <ElsewhereEvents />
        </Suspense>
      )}
    </main>
  );
}
