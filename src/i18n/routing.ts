// Per-language addresses for public pages (Change 3, D72, FR-24): /{prefix}/... for each switched-on
// language, English without a prefix. No automatic redirect (FR-24.3) and no next-intl cookie: the
// language cookie is ours (gventz_lang) and only the switcher sets it.
import { defineRouting } from "next-intl/routing";
import { DEFAULT_LANGUAGE, LANGUAGE_INFO, enabledLanguages, fromPrefix, prefixOf, type Locale } from "./languages";

const enabled = enabledLanguages();

export const routing = defineRouting({
  locales: enabled,
  defaultLocale: DEFAULT_LANGUAGE,
  localePrefix: {
    mode: "as-needed",
    prefixes: Object.fromEntries(enabled.filter((l) => l !== DEFAULT_LANGUAGE).map((l) => [l, `/${LANGUAGE_INFO[l].prefix}`])) as Partial<Record<Locale, string>>,
  },
  localeDetection: false,
  localeCookie: false,
  // hreflang links come from our own metadata (W9), only on public pages.
  alternateLinks: false,
});

/** Public pages: served per language under /{prefix}; everything else keeps one address. */
const PUBLIC = /^\/(?:$|discover(?:\/|$)|e\/[^/]+\/?$|t\/[^/]+\/?$|pricing\/?$|help\/?$|terms\/?$|privacy\/?$|refunds\/?$)/;

/** Splits a known language prefix off a path: "/fr/e/x" → { lang: "fr", rest: "/e/x" }. */
export function splitPrefix(pathname: string): { lang: Locale | null; rest: string } {
  const m = /^\/([a-zA-Z-]+)(\/.*)?$/.exec(pathname);
  if (m) {
    const lang = fromPrefix(m[1]!);
    if (lang && lang !== DEFAULT_LANGUAGE) return { lang, rest: m[2] || "/" };
  }
  return { lang: null, rest: pathname };
}

/** Whether a path (with or without a language prefix) is a public, per-language page. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC.test(splitPrefix(pathname).rest);
}

/** The same page in another language: public pages get that language's prefix; others are unchanged. */
export function localizedPath(pathname: string, lang: Locale): string {
  const { rest } = splitPrefix(pathname);
  if (!PUBLIC.test(rest)) return pathname;
  const prefix = prefixOf(lang);
  if (!prefix) return rest;
  return rest === "/" ? `/${prefix}` : `/${prefix}${rest}`;
}

/** "/en/discover" and "/en": English addresses with the (internal) prefix, which redirect to the unprefixed one. */
export function isEnglishPrefixed(pathname: string): boolean {
  const m = /^\/en(\/.*)?$/.exec(pathname);
  return !!m && PUBLIC.test(m[1] || "/");
}
