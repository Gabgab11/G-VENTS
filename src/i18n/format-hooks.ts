"use client";
// Dates, times and prices in the page's language, for client components (FR-25). Server components
// use getFormat() from ./format-server.
import { useLocale } from "next-intl";
import { useMemo } from "react";
import { bindFormat } from "./format-bind";
import type { Locale } from "./languages";

export function useFormat() {
  const lang = useLocale() as Locale;
  return useMemo(() => bindFormat(lang), [lang]);
}
