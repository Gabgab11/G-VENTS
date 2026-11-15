// Dates, times and prices in the request's language, for server components (FR-25).
import { getLocale } from "next-intl/server";
import { bindFormat } from "./format-bind";
import type { Locale } from "./languages";

export async function getFormat() {
  return bindFormat((await getLocale()) as Locale);
}
