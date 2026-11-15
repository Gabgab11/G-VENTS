// Which language a request gets (W3, FR-23): the address on public pages; otherwise the
// gventz_lang cookie (set by the switcher and from the profile at sign-in), then the browser's
// Accept-Language, then English. The admin dashboard follows the same choice for the shared header;
// its own pages are written in English (D69) and marked lang="en". Pure, so the
// middleware and tests share it.
import { DEFAULT_LANGUAGE, enabledLanguages, fromAcceptLanguage, isEnabled, type Locale } from "./languages";
import { splitPrefix } from "./routing";

export const LANGUAGE_COOKIE = "gventz_lang";
/** Request header the middleware sets for pages without a language in their address. */
export const LANGUAGE_HEADER = "x-gventz-lang";

export function resolveLanguage(
  input: { pathname: string; cookie: string | null | undefined; acceptLanguage: string | null | undefined },
  enabled: readonly Locale[] = enabledLanguages(),
): Locale {
  const { lang } = splitPrefix(input.pathname);
  if (lang && enabled.includes(lang)) return lang;
  if (isEnabled(input.cookie, enabled)) return input.cookie;
  return fromAcceptLanguage(input.acceptLanguage, enabled) ?? DEFAULT_LANGUAGE;
}

/** The language a visitor would prefer, ignoring the address (for the "also in …" hint, W8). */
export function preferredLanguage(cookie: string | null | undefined, acceptLanguage: string | null | undefined, enabled: readonly Locale[] = enabledLanguages()): Locale {
  if (isEnabled(cookie, enabled)) return cookie;
  return fromAcceptLanguage(acceptLanguage, enabled) ?? DEFAULT_LANGUAGE;
}
