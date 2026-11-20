// Addresses of the share cards on gventz-api (Change 4, D81): pure helpers for src/lib/share-card.ts.
import { enabledLanguages, isEnabled, DEFAULT_LANGUAGE, type Locale } from "@/i18n/languages";

/** The `lang` query parameter, if it is a switched-on language; otherwise English. */
export function cardLanguage(param: string | null, enabled: readonly Locale[] = enabledLanguages()): Locale {
  return param && isEnabled(param, enabled) ? param : DEFAULT_LANGUAGE;
}

/**
 * The API path of a card: `/v1/share-cards/events/{slug}.png?lang=…&v=…` or `/v1/share-cards/site.png?lang=…`.
 * The pseudo-language is drawn in English. Null for a slug that can't be an event's.
 */
export function cardApiPath(card: { kind: "event"; slug: string } | { kind: "site" }, lang: Locale, version: string | null): string | null {
  const query = new URLSearchParams({ lang: lang === "en-XA" ? DEFAULT_LANGUAGE : lang });
  if (version) query.set("v", version.slice(0, 64));
  if (card.kind === "site") return `/v1/share-cards/site.png?${query}`;
  const slug = card.slug.trim();
  if (!slug || slug.length > 200 || /[/\\?#]/.test(slug)) return null;
  return `/v1/share-cards/events/${encodeURIComponent(slug)}.png?${query}`;
}
