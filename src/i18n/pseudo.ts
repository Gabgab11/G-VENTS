// The pseudo-language en-XA (W12, development only): English with accented letters and about a
// third longer, in brackets, so text that isn't in a catalogue yet (still plain English) and labels
// that would be clipped in longer languages stand out. ICU syntax ({name}, <b>, plural keys) is kept.
import type { Catalogue } from "./catalogue";

const ACCENTS: Record<string, string> = { a: "à", e: "é", i: "î", o: "ö", u: "ü", c: "ç", n: "ñ", s: "š", y: "ý", A: "À", E: "É", I: "Î", O: "Ö", U: "Ü", C: "Ç", N: "Ñ", S: "Š", Y: "Ý" };

export function pseudo(message: string): string {
  let depth = 0;
  let inTag = false;
  let out = "";
  let letters = 0;
  for (const ch of message) {
    if (ch === "{") depth++;
    if (ch === "}") depth = Math.max(0, depth - 1);
    if (ch === "<") inTag = true;
    const literal = depth === 0 && !inTag;
    if (ch === ">") inTag = false;
    if (literal && /[A-Za-z]/.test(ch)) letters++;
    out += literal ? ACCENTS[ch] ?? ch : ch;
  }
  return `[${out}${"~".repeat(Math.ceil(letters * 0.35))}]`;
}

export function pseudoCatalogue(catalogue: Catalogue): Catalogue {
  return Object.fromEntries(Object.entries(catalogue).map(([k, v]) => [k, typeof v === "string" ? pseudo(v) : pseudoCatalogue(v)]));
}
