import type { MetadataRoute } from "next";
import { languageAlternates } from "@/i18n/seo";
import { enabledLanguages, isLanguage } from "@/i18n/languages";
import { env } from "@/lib/env";
import { localizedPath } from "@/i18n/routing";

// The public pages in every switched-on language, each listing its other languages (W9, FR-24.2).
const PAGES = ["/", "/discover", "/pricing", "/help", "/about", "/terms", "/privacy", "/refunds"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = enabledLanguages().filter(isLanguage);
  return PAGES.flatMap((path) =>
    languages.map((lang) => ({
      url: `${env.siteUrl}${localizedPath(path, lang) === "/" ? "" : localizedPath(path, lang)}` || env.siteUrl,
      alternates: { languages: languageAlternates(path, lang, languages).languages as Record<string, string> },
      changeFrequency: path === "/" || path === "/discover" ? ("daily" as const) : ("monthly" as const),
    })),
  );
}
