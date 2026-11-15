// The languages G-ventZ is offered in (Change 3, D68), and which of them are switched on.
// The codes match gventz-api and profiles.language. English is the source and the fallback.
// NEXT_PUBLIC_LANGUAGES switches languages on (D76: only "en" until every language is reviewed);
// it is read with literal property access so Next.js inlines it for the browser and middleware.

export const LANGUAGES = ["en", "es", "fr", "de", "zh-Hans", "pt", "ar"] as const;
export type Language = (typeof LANGUAGES)[number];

/** The pseudo-language used in development to find text that isn't in a catalogue yet (W12). */
export const PSEUDO = "en-XA" as const;
export type Locale = Language | typeof PSEUDO;

export const DEFAULT_LANGUAGE: Language = "en";

type Info = { prefix: string; name: string; dir: "ltr" | "rtl"; hreflang: string };

export const LANGUAGE_INFO: Record<Locale, Info> = {
  en: { prefix: "", name: "English", dir: "ltr", hreflang: "en" },
  es: { prefix: "es", name: "Español", dir: "ltr", hreflang: "es" },
  fr: { prefix: "fr", name: "Français", dir: "ltr", hreflang: "fr" },
  de: { prefix: "de", name: "Deutsch", dir: "ltr", hreflang: "de" },
  "zh-Hans": { prefix: "zh", name: "中文（简体）", dir: "ltr", hreflang: "zh-Hans" },
  pt: { prefix: "pt", name: "Português", dir: "ltr", hreflang: "pt-BR" },
  ar: { prefix: "ar", name: "العربية", dir: "rtl", hreflang: "ar" },
  "en-XA": { prefix: "en-xa", name: "Ëñğļîšĥ (pseudo)", dir: "ltr", hreflang: "en-XA" },
};

const ALL: readonly string[] = [...LANGUAGES, PSEUDO];

/** Exactly one of the seven codes (no case folding, no regional variants): FR-23.5. */
export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && ALL.includes(value);
}

/**
 * The switched-on languages, English always first. Unknown codes in the setting are ignored; the
 * pseudo-language only outside production.
 */
export function enabledLanguages(setting: string | undefined = process.env.NEXT_PUBLIC_LANGUAGES, production = process.env.NODE_ENV === "production"): Locale[] {
  const wanted = new Set((setting ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const list: Locale[] = [DEFAULT_LANGUAGE];
  for (const code of [...LANGUAGES, PSEUDO] as Locale[]) {
    if (code === DEFAULT_LANGUAGE || !wanted.has(code)) continue;
    if (code === PSEUDO && production) continue;
    list.push(code);
  }
  return list;
}

export function isEnabled(value: unknown, enabled: readonly Locale[] = enabledLanguages()): value is Locale {
  return typeof value === "string" && (enabled as readonly string[]).includes(value);
}

/** "zh" → "zh-Hans"; "" → "en"; anything else → null. */
export function fromPrefix(prefix: string): Locale | null {
  const found = (Object.keys(LANGUAGE_INFO) as Locale[]).find((l) => LANGUAGE_INFO[l].prefix === prefix);
  return found ?? null;
}

export function prefixOf(lang: Locale): string {
  return LANGUAGE_INFO[lang].prefix;
}

export function dirOf(lang: Locale): "ltr" | "rtl" {
  return LANGUAGE_INFO[lang].dir;
}

/**
 * The best switched-on language for an Accept-Language header: q-values honoured, an exact code
 * first, then the base language ("fr-CA" → fr, "zh-CN"/"zh" → zh-Hans, "pt-PT" → pt). Null when
 * nothing matches.
 */
export function fromAcceptLanguage(header: string | null | undefined, enabled: readonly Locale[] = enabledLanguages()): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag: (tag ?? "").trim(), weight: Number.isFinite(weight) ? weight : 0, i };
    })
    .filter((x) => x.tag && x.tag !== "*" && x.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.i - b.i);
  for (const { tag } of ranked) {
    const exact = enabled.find((l) => l.toLowerCase() === tag.toLowerCase());
    if (exact) return exact;
    const base = tag.split("-")[0]!.toLowerCase();
    const byBase = enabled.find((l) => l !== PSEUDO && l.split("-")[0]!.toLowerCase() === base);
    if (byBase) return byBase;
  }
  return null;
}
