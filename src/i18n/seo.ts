// Search engines and languages (W9, FR-24.2): every public page lists its versions in each
// switched-on language (hreflang) plus x-default (English, the unprefixed address), with itself as
// the canonical address.
import type { Metadata } from "next";
import { env } from "@/lib/env";
import { LANGUAGE_INFO, enabledLanguages, type Locale } from "./languages";
import { localizedPath } from "./routing";

export function languageAlternates(path: string, lang: Locale, enabled: readonly Locale[] = enabledLanguages(), site = env.siteUrl): NonNullable<Metadata["alternates"]> {
  const abs = (p: string) => `${site}${p === "/" ? "" : p}` || site;
  const languages: Record<string, string> = {};
  for (const l of enabled) languages[LANGUAGE_INFO[l].hreflang] = abs(localizedPath(path, l)) || site;
  languages["x-default"] = abs(localizedPath(path, "en")) || site;
  return { canonical: abs(localizedPath(path, lang)) || site, languages };
}

/** A page's metadata plus its language alternates, for `generateMetadata({ params })`. */
export async function withAlternates(params: Promise<{ lang: string }>, path: string, metadata: Metadata = {}): Promise<Metadata> {
  const { lang } = await params;
  return { ...metadata, alternates: languageAlternates(path, lang as Locale) };
}
