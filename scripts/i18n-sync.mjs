// Keeps every language's catalogues complete (Change 3, S5): a message English has but another
// language doesn't yet is copied in English and listed in messages/{lang}/_pending.json ("needs
// translation"), so builds stay green and the English fallback is explicit. Messages a language
// has that English no longer has are removed. Run after changing English: `npm run i18n:sync`.
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = "messages";
const LANGS = ["es", "fr", "de", "zh-Hans", "pt", "ar"];
const areas = readdirSync(join(ROOT, "en")).filter((f) => f.endsWith(".json"));
const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {});

function sync(en, own, prefix, pending) {
  const out = {};
  for (const [k, v] of Object.entries(en)) {
    const id = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object") out[k] = sync(v, typeof own?.[k] === "object" ? own[k] : {}, id, pending);
    else if (typeof own?.[k] === "string") out[k] = own[k];
    else { out[k] = v; pending.push(id); }
  }
  return out;
}

for (const lang of LANGS) {
  mkdirSync(join(ROOT, lang), { recursive: true });
  const pendingFile = join(ROOT, lang, "_pending.json");
  const stillPending = new Set(read(pendingFile).ids ?? []);
  const pending = [];
  for (const area of areas) {
    const name = area.replace(/\.json$/, "");
    const file = join(ROOT, lang, area);
    const before = read(file);
    const added = [];
    const next = sync(read(join(ROOT, "en", area)), before, name, added);
    writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
    // Ids copied now, plus ids copied earlier whose text is still the English copy.
    const flat = (o, p = name) => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, `${p}.${k}`) : [[`${p}.${k}`, v]]));
    const english = new Map(flat(read(join(ROOT, "en", area))));
    for (const [id, text] of flat(next)) if (added.includes(id) || (stillPending.has(id) && text === english.get(id))) pending.push(id);
  }
  writeFileSync(pendingFile, JSON.stringify({ note: "Messages still in English, waiting for translation (Change 3, S5).", ids: pending.sort() }, null, 2) + "\n");
  console.log(`${lang}: ${pending.length} waiting for translation`);
}
