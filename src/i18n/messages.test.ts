import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compareWithEnglish, flatten, shapeOf, type Catalogue } from "./catalogue";
import { LANGUAGES } from "./languages";
import { intlLocale } from "@/lib/format";

// NFR-9: every language has exactly English's ids, with the same placeholders, tags and valid
// plural forms. Languages whose folder doesn't exist yet are skipped until I5 adds them.
const ROOT = join(process.cwd(), "messages");
const areas = readdirSync(join(ROOT, "en")).filter((f) => f.endsWith(".json"));
const load = (lang: string) =>
  flatten(Object.fromEntries(areas.map((a) => [a.replace(/\.json$/, ""), existsSync(join(ROOT, lang, a)) ? JSON.parse(readFileSync(join(ROOT, lang, a), "utf8")) : {}])) as Catalogue);
const english = load("en");

describe("message catalogues (W11, NFR-9)", () => {
  it("English messages are valid ICU and ids are well formed", () => {
    for (const [id, message] of Object.entries(english)) {
      expect(() => shapeOf(message), id).not.toThrow();
      expect(id, "ids are dotted lowerCamel/snake segments").toMatch(/^[a-z][A-Za-z0-9_]*(\.[a-z][A-Za-z0-9_]*)+$/);
    }
  });

  for (const lang of LANGUAGES.filter((l) => l !== "en" && existsSync(join(ROOT, l)))) {
    it(`${lang} matches English`, () => {
      expect(compareWithEnglish(english, load(lang), intlLocale(lang))).toEqual([]);
    });
  }

  it("the checker finds missing ids, changed placeholders and impossible plural forms (PBT)", () => {
    const en = { "a.b": "Hello {name}", "a.c": "{count, plural, one {# ticket} other {# tickets}}", "a.d": "<b>Bold</b> text" };
    expect(compareWithEnglish(en, { ...en }, "fr")).toEqual([]);
    expect(compareWithEnglish(en, { ...en, "a.b": "Bonjour {nom}" }, "fr")).toEqual(["placeholders a.b: nom ≠ name"]);
    expect(compareWithEnglish(en, { ...en, "a.d": "Gras" }, "fr")).toEqual(["tags a.d: none ≠ b"]);
    expect(compareWithEnglish(en, { ...en, "a.c": "{count, plural, few {#} other {#}}" }, "en")).toEqual(['plural a.c: "few" isn\'t a plural form in en']);
    expect(compareWithEnglish(en, { ...en, "a.c": "{count, plural, zero {#} one {#} two {#} few {#} many {#} other {#}}" }, "ar")).toEqual([]);
    fc.assert(
      fc.property(fc.subarray(Object.keys(en)), (dropped) => {
        const other = Object.fromEntries(Object.entries(en).filter(([k]) => !dropped.includes(k)));
        expect(compareWithEnglish(en, other, "de")).toEqual(dropped.map((k) => `missing ${k}`));
      }),
    );
  });
});
