import type { EventPage } from "@/lib/event-page";

// The venue map on the event page. With NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY (a browser key limited to
// the Maps Embed API and this site's domains) it uses the official embed, centred on the Google
// place; without it, Google's plain embed by coordinates or address. Directions open Google Maps.

type Location = EventPage["location"];

export function mapTarget(location: Location): { query: string; placeId: string | null } | null {
  if (location.kind !== "venue") return null;
  const place = location.place;
  if (place) return { query: `${place.lat},${place.lng}`, placeId: place.placeId };
  const address = [location.venueName, location.address, location.city, location.region, location.country].filter(Boolean).join(", ");
  return address ? { query: address, placeId: null } : null;
}

export function mapEmbedUrl(location: Location, key: string): string | null {
  const target = mapTarget(location);
  if (!target) return null;
  if (key) {
    const q = target.placeId ? `place_id:${target.placeId}` : target.query;
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&zoom=15`;
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(target.query)}&z=15&output=embed`;
}

export function directionsUrl(location: Location): string | null {
  const target = mapTarget(location);
  if (!target) return null;
  const place = target.placeId ? `&destination_place_id=${encodeURIComponent(target.placeId)}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target.query)}${place}`;
}

export default function VenueMap({ location, title }: { location: Location; title: string }) {
  const src = mapEmbedUrl(location, process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY ?? "");
  if (!src) return null;
  return (
    <iframe
      className="ev-map"
      src={src}
      title={`Map of ${title}`}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  );
}
