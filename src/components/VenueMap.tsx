import { MapPin } from "lucide-react";
import type { EventPage } from "@/lib/event-page";
import ShowMap from "@/app/[lang]/e/[slug]/ShowMap";

// The venue on the event page (NFR-13): an address card first, with "Open in Google Maps" and a
// "Show map" button. The live Google embed (with NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY, the official
// embed centred on the Google place; without it, Google's plain embed) loads only when the visitor
// asks for it, so the page doesn't pay for Google's scripts up front. With
// NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY (a key limited to the Maps Static API and this site's domains)
// the card also shows a static map image. Directions open the host's Google Maps link when there is
// one, otherwise Google Maps directions to the venue.

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

/** A static map image of the venue (Maps Static API), or null without a key or a place. */
export function staticMapUrl(location: Location, key: string): string | null {
  if (!key) return null;
  const target = mapTarget(location);
  if (!target) return null;
  const q = encodeURIComponent(target.query);
  return `https://maps.googleapis.com/maps/api/staticmap?center=${q}&zoom=15&size=640x320&scale=2&markers=${q}&key=${encodeURIComponent(key)}`;
}

/** The host's own Google Maps link when they added one (LO6), otherwise directions to the venue. */
export function directionsUrl(location: Location): string | null {
  if (location.kind === "venue" && location.mapsUrl) return location.mapsUrl;
  const target = mapTarget(location);
  if (!target) return null;
  const place = target.placeId ? `&destination_place_id=${encodeURIComponent(target.placeId)}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target.query)}${place}`;
}

export type VenueMapLabels = {
  /** "Open in Google Maps" */
  open: string;
  /** Unused since the map shows by default; optional so callers can drop it. */
  show?: string;
  /** The embed's title, e.g. "Map of {place}" */
  mapTitle: string;
  /** The static image's alt text */
  imageAlt: string;
};

export default function VenueMap({ location, title, subtitle, labels }: { location: Location; title: string; subtitle?: string; labels: VenueMapLabels }) {
  const embed = mapEmbedUrl(location, process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY ?? "");
  const image = staticMapUrl(location, process.env.NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY ?? "");
  const directions = directionsUrl(location);
  if (!embed && !directions) return null;
  return (
    <div className="ev-venue">
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size image from the Maps Static API */}
      {image && !embed && <img className="ev-venue-image" src={image} alt={labels.imageAlt} width={640} height={320} loading="lazy" />}
      <div className="ev-venue-body">
        <MapPin size={20} strokeWidth={1.75} aria-hidden className="ev-venue-pin" />
        <div className="ev-venue-text">
          <div className="ev-fact-title">{title}</div>
          {subtitle && <div className="ev-fact-sub">{subtitle}</div>}
        </div>
      </div>
      <ShowMap src={embed} title={labels.mapTitle} openLabel={labels.open} directions={directions} />
    </div>
  );
}
