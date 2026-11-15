import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { EventCard } from "@/lib/events";
import { formatDateTime, intlLocale, safeZone } from "@/lib/format";
import { themeBackground } from "@/lib/themes";
import type { Locale } from "@/i18n/languages";
import { categoryLabelKey, isCategory } from "@/lib/categories";

export function placeOf(e: Pick<EventCard, "is_online" | "venue_name" | "city">, online: string): string {
  if (e.is_online) return online;
  return [e.venue_name, e.city].filter(Boolean).join(", ");
}

/** "Sat 14 Nov, 18:00", or "Sat 14 Nov – Sun 15 Nov" when it runs over several days (in the page's language). */
export function whenOf(e: Pick<EventCard, "starts_at" | "ends_at" | "timezone">, lang: Locale): string {
  const start = formatDateTime(e.starts_at, e.timezone, lang);
  if (!e.ends_at) return start;
  const day = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(intlLocale(lang, "date"), { weekday: "short", day: "numeric", month: "short", timeZone: safeZone(e.timezone) });
  };
  return day(e.starts_at) === day(e.ends_at) ? start : `${day(e.starts_at)} – ${day(e.ends_at)}`;
}

/** A category's label in the page's language, from a root translator (shared.categories.*); an unknown value is shown as it is. */
export function categoryLabel(category: string, t: (key: string) => string): string {
  return isCategory(category) ? t(categoryLabelKey(category)) : category;
}

// One event in a Discover row: the flyer (or the event's colour style with its name), then the
// name, place and date.
export default function EventTile({ event: e }: { event: EventCard }) {
  const t = useTranslations("discover");
  const root = useTranslations();
  const lang = useLocale() as Locale;
  const place = placeOf(e, t("online"));
  return (
    <Link href={`/e/${e.slug}`} className="dc-tile">
      <span className="dc-tile-cover" style={{ background: themeBackground(e.cover_theme) }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from Supabase Storage at arbitrary sizes */}
        {e.cover_url ? <img src={e.cover_url} alt="" loading="lazy" /> : <span className="dc-tile-cover-title" aria-hidden="true">{e.title}</span>}
        <span className="dc-tile-chip">{categoryLabel(e.category, root)}</span>
      </span>
      <span className="dc-tile-title">{e.title}</span>
      {place && <span className="dc-tile-meta">{place}</span>}
      <span className="dc-tile-meta">{whenOf(e, lang)}</span>
    </Link>
  );
}
