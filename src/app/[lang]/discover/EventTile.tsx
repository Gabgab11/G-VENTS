import Link from "next/link";
import type { EventCard } from "@/lib/events";
import { formatEventDate } from "@/lib/dates";
import { themeBackground } from "@/lib/themes";

export function placeOf(e: Pick<EventCard, "is_online" | "venue_name" | "city">): string {
  if (e.is_online) return "Online";
  return [e.venue_name, e.city].filter(Boolean).join(", ");
}

/** "Sat 14 Nov, 18:00", or "Sat 14 Nov – Sun 15 Nov" when it runs over several days. */
export function whenOf(e: Pick<EventCard, "starts_at" | "ends_at" | "timezone">): string {
  const start = formatEventDate(e.starts_at, e.timezone);
  if (!e.ends_at) return start;
  const day = (iso: string) => formatEventDate(iso, e.timezone).split(",")[0];
  return day(e.starts_at) === day(e.ends_at) ? start : `${day(e.starts_at)} – ${day(e.ends_at)}`;
}

// One event in a Discover row: the flyer (or the event's colour style with its name), then the
// name, place and date.
export default function EventTile({ event: e }: { event: EventCard }) {
  return (
    <Link href={`/e/${e.slug}`} className="dc-tile">
      <span className="dc-tile-cover" style={{ background: themeBackground(e.cover_theme) }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from Supabase Storage at arbitrary sizes */}
        {e.cover_url ? <img src={e.cover_url} alt="" loading="lazy" /> : <span className="dc-tile-cover-title" aria-hidden="true">{e.title}</span>}
        <span className="dc-tile-chip">{e.category}</span>
      </span>
      <span className="dc-tile-title">{e.title}</span>
      {placeOf(e) && <span className="dc-tile-meta">{placeOf(e)}</span>}
      <span className="dc-tile-meta">{whenOf(e)}</span>
    </Link>
  );
}
