// The message catalogues (W4): messages/{code}/{area}.json, with English merged under every other
// language, so a missing message shows English instead of an id (FR-22.3). The pseudo-language is
// built from English (W12).
import type { Catalogue } from "./catalogue";
import { DEFAULT_LANGUAGE, PSEUDO, type Locale } from "./languages";
import { pseudoCatalogue } from "./pseudo";

export const AREAS = ["common", "errors", "shared", "home", "discover", "event", "tickets", "auth", "dashboard", "host", "createEvent", "account", "info", "legal"] as const;

/** What browser components need, per root layout (NFR-10: the rest stays on the server). */
export const PUBLIC_CLIENT_AREAS: readonly Area[] = ["common", "errors", "shared", "home", "discover", "event", "tickets", "info"];
export const SITE_CLIENT_AREAS: readonly Area[] = ["common", "errors", "shared", "auth", "dashboard", "host", "createEvent", "account", "tickets", "event"];
export type Area = (typeof AREAS)[number];

async function loadOne(lang: Locale, area: Area): Promise<Catalogue> {
  try {
    return (await import(`../../messages/${lang}/${area}.json`)).default as Catalogue;
  } catch {
    return {};
  }
}

function deepMerge(base: Catalogue, over: Catalogue): Catalogue {
  const out: Catalogue = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = typeof v === "object" && typeof b === "object" ? deepMerge(b, v) : v;
  }
  return out;
}

export async function loadMessages(lang: Locale): Promise<Catalogue> {
  const english = Object.fromEntries(await Promise.all(AREAS.map(async (a) => [a, await loadOne(DEFAULT_LANGUAGE, a)] as const))) as Catalogue;
  if (lang === DEFAULT_LANGUAGE) return english;
  if (lang === PSEUDO) return pseudoCatalogue(english);
  const own = Object.fromEntries(await Promise.all(AREAS.map(async (a) => [a, await loadOne(lang, a)] as const))) as Catalogue;
  return deepMerge(english, own);
}

/** Only the given areas, for client components (NFR-10: the browser gets what it uses). */
export function pickAreas(messages: Catalogue, areas: readonly Area[]): Catalogue {
  return Object.fromEntries(areas.filter((a) => a in messages).map((a) => [a, messages[a]!]));
}
