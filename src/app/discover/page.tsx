import Link from "next/link";
import "./discover.css";
import SiteHeader from "@/components/SiteHeader";
import { getFeaturedEvents, type EventCard } from "@/lib/events";
import { CATEGORIES, isCategory, type Category } from "@/lib/categories";
import { startsThisWeekend } from "@/lib/dates";
import { env } from "@/lib/env";
import { themeBackground } from "@/lib/themes";
import { pageFonts } from "@/app/fonts";
import CategoryTiles from "./CategoryTiles";
import EventTile, { placeOf, whenOf } from "./EventTile";
import HeroCarousel, { type HeroSlide } from "./HeroCarousel";
import Rail from "./Rail";

export const metadata = { title: "Discover events · G-ventZ" };

const HERO_MAX = 6;
const ROW_MAX = 12;
const CATEGORY_ROWS = 6;

function heroSlides(events: EventCard[]): HeroSlide[] {
  // Events with a flyer lead; the rest fill in, soonest first.
  const ordered = [...events.filter((e) => e.cover_url), ...events.filter((e) => !e.cover_url)].slice(0, HERO_MAX);
  return ordered.map((e) => ({
    slug: e.slug,
    title: e.title,
    category: e.category,
    when: whenOf(e),
    place: placeOf(e),
    coverUrl: e.cover_url,
    background: themeBackground(e.cover_theme),
    shareUrl: `${env.siteUrl}/e/${e.slug}`,
  }));
}

/** Category rows, busiest first; none when one category holds every event (it would repeat "Happening soon"). */
function byCategory(events: EventCard[]): [Category, EventCard[]][] {
  const groups = new Map<Category, EventCard[]>();
  for (const e of events) if (isCategory(e.category)) groups.set(e.category, [...(groups.get(e.category) ?? []), e]);
  return CATEGORIES.filter((c) => groups.has(c))
    .map((c) => [c, groups.get(c)!] as [Category, EventCard[]])
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, CATEGORY_ROWS)
    .filter((row, _, rows) => rows.length > 1 || row[1].length < events.length);
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const sp = await searchParams;
  const category = isCategory(sp.category) ? sp.category : undefined;
  const events = await getFeaturedEvents(50, category);
  const weekend = events.filter((e) => startsThisWeekend(e.starts_at, e.timezone));
  const slides = heroSlides(events);

  return (
    <main className={`dc ${pageFonts}`}>
      <div className="dc-head"><SiteHeader current="/discover" /></div>

      {slides.length > 0 ? (
        <HeroCarousel slides={slides} />
      ) : (
        <section className="dc-hero dc-hero-empty">
          <div className="dc-slide-body">
            <span className="dc-slide-cat">{category ?? "Discover"}</span>
            <h1 className="dc-slide-title">{category ? `No ${category.toLowerCase()} events yet` : "Good gatherings start here"}</h1>
            <p className="dc-slide-meta">Be the first: create an event and share one link with your guests.</p>
            <div className="dc-slide-actions"><Link href="/events/new" className="dc-slide-cta">Create an event</Link></div>
          </div>
        </section>
      )}

      <div className="dc-body">
        <Rail title="Event categories" id="dc-cats-title" track="dc-cats">
          <CategoryTiles active={category} />
        </Rail>

        {category ? (
          <section aria-labelledby="dc-cat-events">
            <div className="dc-rail-head">
              <h2 id="dc-cat-events">{category} events</h2>
              <Link href="/discover" className="dc-link" scroll={false}>All events</Link>
            </div>
            {events.length > 0 ? (
              <div className="dc-grid">{events.map((e) => <EventTile key={e.id} event={e} />)}</div>
            ) : (
              <p className="dc-empty">Nothing coming up in {category.toLowerCase()} yet. <Link href="/events/new">Host one</Link>.</p>
            )}
          </section>
        ) : events.length > 0 ? (
          <>
            <Rail title="Happening soon" id="dc-soon">{events.slice(0, ROW_MAX).map((e) => <EventTile key={e.id} event={e} />)}</Rail>
            {weekend.length > 0 && (
              <Rail title="This weekend" id="dc-weekend">{weekend.slice(0, ROW_MAX).map((e) => <EventTile key={e.id} event={e} />)}</Rail>
            )}
            {byCategory(events).map(([c, list]) => (
              <Rail key={c} title={c} id={`dc-row-${c.toLowerCase()}`}>{list.slice(0, ROW_MAX).map((e) => <EventTile key={e.id} event={e} />)}</Rail>
            ))}
          </>
        ) : (
          <p className="dc-empty">No public events yet. <Link href="/events/new">Create the first one</Link>.</p>
        )}
      </div>
    </main>
  );
}
