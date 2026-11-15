import { createTranslator } from "next-intl";
import { it, expect } from "vitest";
it("group-off", () => {
  for (const locale of ["en", "fr", "ar"]) {
    const t = createTranslator({ locale, messages: { a: "{count, plural, one {{count, number, ::group-off} ticket} other {{count, number, ::group-off} tickets}}" } });
    console.log(locale, t("a", { count: 1000 }), "|", t("a", { count: 1 }));
  }
  expect(true).toBe(true);
});
