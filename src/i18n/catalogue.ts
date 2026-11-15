// Catalogue inspection for the checks in CI (W11, NFR-9): message ids, placeholders, rich-text
// tags and plural forms, read with the ICU parser next-intl uses. Not used at runtime.
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";

export type Catalogue = { [key: string]: string | Catalogue };

/** { a: { b: "x" } } → { "a.b": "x" } */
export function flatten(catalogue: Catalogue, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(catalogue)) {
    const id = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[id] = value;
    else Object.assign(out, flatten(value, id));
  }
  return out;
}

export type Shape = {
  /** Placeholder and argument names, sorted: "{name}", "{count, plural, ...}". */
  args: string[];
  /** Rich-text tag names, sorted: "<b>…</b>". */
  tags: string[];
  /** Plural/selectordinal selectors used, with their option keys. */
  plurals: { arg: string; options: string[] }[];
};

/** The parts of a message that every translation must keep. Throws on invalid ICU syntax. */
export function shapeOf(message: string): Shape {
  const args = new Set<string>();
  const tags = new Set<string>();
  const plurals: Shape["plurals"] = [];
  const walk = (elements: MessageFormatElement[]) => {
    for (const el of elements) {
      switch (el.type) {
        case TYPE.argument:
        case TYPE.number:
        case TYPE.date:
        case TYPE.time:
          args.add(el.value);
          break;
        case TYPE.tag:
          tags.add(el.value);
          walk(el.children);
          break;
        case TYPE.select:
          args.add(el.value);
          for (const option of Object.values(el.options)) walk(option.value);
          break;
        case TYPE.plural:
          args.add(el.value);
          plurals.push({ arg: el.value, options: Object.keys(el.options).sort() });
          for (const option of Object.values(el.options)) walk(option.value);
          break;
        default:
          break;
      }
    }
  };
  walk(parse(message));
  return { args: [...args].sort(), tags: [...tags].sort(), plurals };
}

/** Plural option keys a language may use: its CLDR categories, exact matches (=0, =1) and "other". */
export function allowedPluralKeys(intlLocale: string): Set<string> {
  const categories = new Intl.PluralRules(intlLocale).resolvedOptions().pluralCategories;
  return new Set<string>([...categories, "other"]);
}

/**
 * Problems in one language compared with English: missing or extra ids, changed placeholders or
 * tags, plural keys the language doesn't have, or a plural without "other". Empty when it's right.
 */
export function compareWithEnglish(english: Record<string, string>, other: Record<string, string>, intlLocale: string): string[] {
  const problems: string[] = [];
  const allowed = allowedPluralKeys(intlLocale);
  for (const id of Object.keys(english)) if (!(id in other)) problems.push(`missing ${id}`);
  for (const id of Object.keys(other)) if (!(id in english)) problems.push(`extra ${id}`);
  for (const [id, message] of Object.entries(other)) {
    if (!(id in english)) continue;
    let mine: Shape;
    let source: Shape;
    try {
      mine = shapeOf(message);
      source = shapeOf(english[id]!);
    } catch (e) {
      problems.push(`invalid ${id}: ${(e as Error).message}`);
      continue;
    }
    if (mine.args.join() !== source.args.join()) problems.push(`placeholders ${id}: ${mine.args.join() || "none"} ≠ ${source.args.join() || "none"}`);
    if (mine.tags.join() !== source.tags.join()) problems.push(`tags ${id}: ${mine.tags.join() || "none"} ≠ ${source.tags.join() || "none"}`);
    for (const p of mine.plurals) {
      if (!p.options.includes("other")) problems.push(`plural ${id}: no "other"`);
      for (const key of p.options) if (!key.startsWith("=") && !allowed.has(key)) problems.push(`plural ${id}: "${key}" isn't a plural form in ${intlLocale}`);
    }
  }
  return problems;
}
