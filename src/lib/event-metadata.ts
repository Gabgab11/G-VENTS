// The event page's metadata (Change 4 chunk 2, Step 4): title, description, Open Graph and Twitter
// tags, and noindex for private events. Pure, so it is unit-tested; the page passes in the translated
// bits (price label, "Online", image alt) and the language alternates from withAlternates.
import type { Metadata } from "next";
import { LANGUAGE_INFO, type Locale } from "@/i18n/languages";
import { DATE_STYLES, intlLocale, safeZone } from "@/lib/format";

type EventLike = {
  slug: string;
  title: string;
  description: string | null;
  startsAt: string;
  timeZone: string | null;
  visibility: "public" | "private";
  location: { kind: "venue" | "online"; city?: string | null };
};

export type EventMetadataInput = {
  event: EventLike;
  lang: Locale;
  /** The page's absolute address in this language (the canonical one). */
  url: string;
  /** The share card's absolute address (1200×630). */
  imageUrl: string;
  /** "Free" or "From ₦5,000", already translated. */
  price: string;
  /** "Online", translated. */
  online: string;
  /** The share card's alt text, translated. */
  imageAlt: string;
  alternates?: Metadata["alternates"];
};

export const DESCRIPTION_MAX = 160;

/** Cut to at most `max` characters on a word boundary, with an ellipsis when something was cut. */
export function clip(text: string, max = DESCRIPTION_MAX): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:·-]+$/, "")}…`;
}

/** The description's first non-empty line. */
export function firstLine(text: string | null | undefined): string {
  return (text ?? "").split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
}

/** "Sat 5 Dec, 18:00" in the event's own time zone and the page's language. */
export function metaDate(startsAt: string, timeZone: string | null, lang: Locale): string {
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(intlLocale(lang, "date"), { ...DATE_STYLES.short, timeZone: safeZone(timeZone) });
}

/** "Sat 5 Dec, 18:00 · Lagos · From ₦5,000 · First line of the description", at most 160 characters. */
export function eventDescription(input: Pick<EventMetadataInput, "event" | "lang" | "price" | "online">): string {
  const { event, lang, price, online } = input;
  const place = event.location.kind === "online" ? online : event.location.city || "";
  const facts = [metaDate(event.startsAt, event.timeZone, lang), place, price].filter(Boolean).join(" · ");
  const line = firstLine(event.description);
  return clip(line ? `${facts} · ${line}` : facts);
}

/** Open Graph locale ("fr", "pt_BR", "zh_Hans"). */
export function ogLocale(lang: Locale): string {
  return LANGUAGE_INFO[lang].hreflang.replace("-", "_");
}

export function buildEventMetadata(input: EventMetadataInput): Metadata {
  const { event, lang, url, imageUrl, imageAlt, alternates } = input;
  const title = `${event.title} · G-ventZ`;
  const description = eventDescription(input);
  const images = [{ url: imageUrl, width: 1200, height: 630, alt: imageAlt }];
  return {
    title,
    description,
    ...(alternates ? { alternates } : {}),
    // Next's metadata has no og:type "event"; "website" is what link previews read reliably anyway.
    openGraph: { type: "website", url, title, description, siteName: "G-ventZ", locale: ogLocale(lang), images },
    twitter: { card: "summary_large_image", title, description, images },
    ...(event.visibility === "private" ? { robots: { index: false, follow: false } } : {}),
  };
}
