// next-intl's per-request configuration (W3). Public pages get their language from the address
// (static rendering per language); every other page from the header the middleware sets after
// resolving cookie → Accept-Language → English (resolve.ts). Missing messages fall back to English
// (merged in loadMessages) and are logged once per id and language.
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { DEFAULT_LANGUAGE, isEnabled } from "./languages";
import { loadMessages } from "./messages";
import { LANGUAGE_HEADER } from "./resolve";
import { routing } from "./routing";

const reported = new Set<string>();

export default getRequestConfig(async ({ requestLocale }) => {
  const segment = await requestLocale;
  let locale = hasLocale(routing.locales, segment) ? segment : null;
  if (!locale && segment) {
    // A public address with an unknown language (/xx/help): its 404 page, in English. Reading
    // headers() here would make a static page dynamic and turn the 404 into a 500.
    locale = DEFAULT_LANGUAGE;
  } else if (!locale) {
    // Not a public page: the middleware already chose (headers() keeps these pages dynamic, as they were).
    const chosen = (await headers()).get(LANGUAGE_HEADER);
    locale = isEnabled(chosen) ? chosen : DEFAULT_LANGUAGE;
  }
  return {
    locale,
    messages: await loadMessages(locale),
    onError(error) {
      const key = `${locale}:${error.message}`;
      if (reported.has(key)) return;
      reported.add(key);
      console.warn(`[i18n] ${locale}: ${error.message}`);
    },
    getMessageFallback({ namespace, key }) {
      return [namespace, key].filter(Boolean).join(".");
    },
  };
});
