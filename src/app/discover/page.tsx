import Link from "next/link";
import ColorModeToggle from "@/components/ColorModeToggle";
import { getFeaturedEvents } from "@/lib/events";
import { themeBackground } from "@/lib/themes";
import { CATEGORIES, isCategory } from "@/lib/categories";
import { formatEventDate } from "@/lib/dates";
import CategoryBrowser from "@/components/CategoryBrowser";

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const sp = await searchParams;
  const category = isCategory(sp.category) ? sp.category : undefined;
  const events = await getFeaturedEvents(12, category);

  return (
    <main className="wrap page wide">
      <div className="back-row spread">
        <Link href="/" className="back-link">← Home</Link>
        <ColorModeToggle />
      </div>
      <div className="section-head">
        <h1>Discover</h1>
        <p className="muted">Events on G-vents.</p>
      </div>

      <CategoryBrowser categories={CATEGORIES} active={category} />

      <section>
        <div className="cat-head">
          <h2>{category ? `${category} on G-vents` : "On G-vents"}</h2>
          {category && <Link href="/discover" className="gold small">Show all</Link>}
        </div>
        {events.length > 0 ? (
          <div className="ext-grid">
            {events.map((e) => (
              <Link key={e.id} href={`/e/${e.slug}`} className="event-card">
                <div className="event-card-cover" style={{ background: themeBackground(e.cover_theme) }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from Supabase Storage at arbitrary sizes */}
                  {e.cover_url && <img src={e.cover_url} alt="" />}
                </div>
                <span className="source-tag">{e.category}</span>
                <b className="ext-title">{e.title}</b>
                <span className="muted small">{formatEventDate(e.starts_at, e.timezone)}{e.city ? ` · ${e.city}` : ""}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted">{category ? `No upcoming ${category.toLowerCase()} events yet.` : "No public G-vents events yet. Hosts can publish one from their dashboard."}</p>
        )}
      </section>
    </main>
  );
}
