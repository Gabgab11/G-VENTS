// Addresses of the share cards on gventz-api (Change 4, D81): pure helpers for src/lib/share-card.ts.
import { enabledLanguages, isEnabled, DEFAULT_LANGUAGE, type Locale } from "@/i18n/languages";

/** The `lang` query parameter, if it is a switched-on language; otherwise English. */
export function cardLanguage(param: string | null, enabled: readonly Locale[] = enabledLanguages()): Locale {
  return param && isEnabled(param, enabled) ? param : DEFAULT_LANGUAGE;
}

/**
 * The API path of a card: `/v1/share-cards/events/{slug}.png?lang=…&v=…`, `/v1/share-cards/hosts/{handle}.png?…`
 * or `/v1/share-cards/site.png?lang=…`.
 * The pseudo-language is drawn in English. Null for a slug that can't be an event's.
 */
export type ShareCard = { kind: "event"; slug: string } | { kind: "host"; handle: string } | { kind: "site" };

export function cardApiPath(card: ShareCard, lang: Locale, version: string | null): string | null {
  const query = new URLSearchParams({ lang: lang === "en-XA" ? DEFAULT_LANGUAGE : lang });
  if (version) query.set("v", version.slice(0, 64));
  if (card.kind === "site") return `/v1/share-cards/site.png?${query}`;
  if (card.kind === "host") {
    // The API normalises handles itself; this only keeps the request inside the cards' path.
    const handle = card.handle.trim();
    if (!/^@?[A-Za-z0-9-]{1,40}$/.test(handle)) return null;
    return `/v1/share-cards/hosts/${encodeURIComponent(handle)}.png?${query}`;
  }
  const slug = card.slug.trim();
  if (!slug || slug.length > 200 || /[/\\?#]/.test(slug)) return null;
  return `/v1/share-cards/events/${encodeURIComponent(slug)}.png?${query}`;
}

/**
 * Where the website sends a profile card the API moved (an old handle answers 308 with the new
 * handle's card): the same /api/og/h/… address with the new handle, keeping this request's query.
 * Null when the API's Location isn't a profile card.
 */
export function movedCardPath(location: string | null, search: string): string | null {
  if (!location) return null;
  let path: string;
  try {
    path = new URL(location, "https://api.invalid").pathname;
  } catch {
    return null;
  }
  const m = /^\/v1\/share-cards\/hosts\/([A-Za-z0-9-]{1,40})\.png$/.exec(path);
  return m ? `/api/og/h/${m[1]}${search}` : null;
}
