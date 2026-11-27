import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { withAlternates } from "@/i18n/seo";
import "./discover.css";
import SiteHeader from "@/components/SiteHeader";
import { getFeaturedEvents, type EventCard } from "@/lib/events";
import { CATEGORIES, isCategory, type Category } from "@/lib/categories";
import { startsThisWeekend } from "@/lib/dates";
import { env } from "@/lib/env";
import { themeBackground } from "@/lib/themes";
import { pageFonts } from "@/app/fonts";
import CategoryTiles from "./CategoryTiles";
import EventTile, { categoryLabel, placeOf, whenOf } from "./EventTile";
import type { Locale } from "@/i18n/languages";
import HeroCarousel, { type HeroSlide } from "./HeroCarousel";
import Rail from "./Rail";
import { searchApi } from "@/components/search/server";
import { cleanQuery, type SearchEvent } from "@/components/search/types";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("discover");
  return withAlternates(params, "/discover", { title: t("meta.title") });
}

const HERO_MAX = 6;
const ROW_MAX = 12;
const CATEGORY_ROWS = 6;

type T = Awaited<ReturnType<typeof getTranslations>>;

function heroSlides(events: EventCard[], t: T, root: T, lang: Locale): HeroSlide[] {
  // Events with a flyer lead; the rest fill in, soonest first.
  const ordered = [...events.filter((e) => e.cover_url), ...events.filter((e) => !e.cover_url)].slice(0, HERO_MAX);
  return ordered.map((e) => ({
    slug: e.slug,
    title: e.title,
    category: categoryLabel(e.category, root),
    when: whenOf(e, lang),
    place: placeOf(e, t("online")),
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

const SEARCH_MAX = 20; // the most /v1/search returns

/** A search hit as a Discover card (the search answer has no category, venue or end time). */
function searchCard(e: SearchEvent): EventCard {
  return {
    id: e.id, title: e.title, slug: e.slug, category: "", starts_at: e.startsAt, ends_at: null, timezone: e.timeZone,
    venue_name: null, is_online: e.isOnline, city: e.city, country: null, cover_theme: e.coverTheme, cover_url: e.coverUrl,
    min_price_minor: e.minPriceMinor, currency: e.currency,
  };
}

/** Events matching ?q= ("Search all on Discover" in the ⌘K palette, FR-34) via the API's /v1/search; null when search is down. */
async function searchEvents(q: string, lang: string): Promise<EventCard[] | null> {
  try {
    return (await searchApi(q, lang, SEARCH_MAX)).events.map(searchCard);
  } catch (error) {
    console.warn("[discover] search unavailable", error);
    return null;
  }
}

export default async function DiscoverPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ category?: string; q?: string | string[] }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("discover");
  const root = await getTranslations();
  const sp = await searchParams;
  const rawQuery = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  if (rawQuery !== undefined) return <SearchResultsPage query={rawQuery} lang={lang} t={t} />;
  const category = isCategory(sp.category) ? sp.category : undefined;
  const events = await getFeaturedEvents(50, category);
  const weekend = events.filter((e) => startsThisWeekend(e.starts_at, e.timezone));
  const slides = heroSlides(events, t, root, lang as Locale);
  const label = category ? categoryLabel(category, root) : undefined;
  const inSentence = category ? t(`inSentence.${category.toLowerCase()}`) : undefined;

  return (
    <main className={`dc ${pageFonts}`}>
      <div className="dc-head"><SiteHeader current="/discover" /></div>

      {slides.length > 0 ? (
        <HeroCarousel slides={slides} />
      ) : (
        <section className="dc-hero dc-hero-empty">
          <div className="dc-slide-body">
            <span className="dc-slide-cat">{label ?? t("empty.discover")}</span>
            <h1 className="dc-slide-title">{inSentence ? t("empty.categoryTitle", { category: inSentence }) : t("empty.title")}</h1>
            <p className="dc-slide-meta">{t("empty.text")}</p>
            <div className="dc-slide-actions"><Link href="/host/events/new" className="dc-slide-cta">{t("empty.create")}</Link></div>
          </div>
        </section>
      )}

      <div className="dc-body">
        <Rail title={t("rails.categories")} id="dc-cats-title" track="dc-cats">
          <CategoryTiles active={category} />
        </Rail>

        {category ? (
          <section aria-labelledby="dc-cat-events">
            <div className="dc-rail-head">
              <h2 id="dc-cat-events">{t("categoryEvents", { category: label! })}</h2>
              <Link href="/discover" className="dc-link" scroll={false}>{t("allEvents")}</Link>
            </div>
            {events.length > 0 ? (
              <div className="dc-grid">{events.map((e) => <EventTile key={e.id} event={e} />)}</div>
            ) : (
              <p className="dc-empty">{t.rich("categoryEmpty", { category: inSentence!, link: (c) => <Link href="/host/events/new">{c}</Link> })}</p>
            )}
          </section>
        ) : events.length > 0 ? (
          <>
            <Rail title={t("rails.soon")} id="dc-soon">{events.slice(0, ROW_MAX).map((e) => <EventTile key={e.id} event={e} />)}</Rail>
            {weekend.length > 0 && (
              <Rail title={t("rails.weekend")} id="dc-weekend">{weekend.slice(0, ROW_MAX).map((e) => <EventTile key={e.id} event={e} />)}</Rail>
            )}
            {byCategory(events).map(([c, list]) => (
              <Rail key={c} title={categoryLabel(c, root)} id={`dc-row-${c.toLowerCase()}`}>{list.slice(0, ROW_MAX).map((e) => <EventTile key={e.id} event={e} />)}</Rail>
            ))}
          </>
        ) : (
          <p className="dc-empty">{t.rich("noEvents", { link: (c) => <Link href="/host/events/new">{c}</Link> })}</p>
        )}
      </div>
    </main>
  );
}

// Discover filtered by text (?q=): the matching events as cards, then the category tiles.
async function SearchResultsPage({ query: raw, lang, t }: { query: string; lang: string; t: T }) {
  const query = cleanQuery(raw);
  const events = query ? await searchEvents(query, lang) : [];
  return (
    <main className={`dc ${pageFonts}`}>
      <div className="dc-head"><SiteHeader current="/discover" /></div>
      <div className="dc-body">
        <section aria-labelledby="dc-search">
          <div className="dc-rail-head">
            <h1 id="dc-search" className="dc-search-title">{query ? t("search.title", { query }) : t("search.short")}</h1>
            <Link href="/discover" className="dc-link">{t("search.clear")}</Link>
          </div>
          {events === null ? (
            <p className="dc-empty" role="alert">{t("search.unavailable")}</p>
          ) : events.length > 0 ? (
            <div className="dc-grid">{events.map((e) => <EventTile key={e.id} event={e} />)}</div>
          ) : query ? (
            <p className="dc-empty">{t("search.empty", { query })}</p>
          ) : null}
        </section>
        <Rail title={t("rails.categories")} id="dc-cats-title" track="dc-cats">
          <CategoryTiles />
        </Rail>
      </div>
    </main>
  );
}
