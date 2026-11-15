// Physical → logical CSS (Change 3, W10, FR-22.4). `node scripts/logical-css.mjs --check <files>`
// lists left/right-only declarations (used by `npm run lint`); without --check it rewrites them.
// In left-to-right languages the result renders exactly as before; in Arabic it mirrors.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function cssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === "admin" ? [] : cssFiles(join(dir, e.name))) : e.name.endsWith(".css") ? [join(dir, e.name)] : []));
}

const RULES = [
  [/\b(margin|padding)-left(?=\s*:)/g, "$1-inline-start"],
  [/\b(margin|padding)-right(?=\s*:)/g, "$1-inline-end"],
  [/\bborder-left(-width|-color|-style)?(?=\s*:)/g, "border-inline-start$1"],
  [/\bborder-right(-width|-color|-style)?(?=\s*:)/g, "border-inline-end$1"],
  [/\bborder-top-left-radius(?=\s*:)/g, "border-start-start-radius"],
  [/\bborder-top-right-radius(?=\s*:)/g, "border-start-end-radius"],
  [/\bborder-bottom-left-radius(?=\s*:)/g, "border-end-start-radius"],
  [/\bborder-bottom-right-radius(?=\s*:)/g, "border-end-end-radius"],
  // `left: 50%` (with translateX(-50%)) centres, the same in both directions: kept physical.
  [/(^|[\s;{])left(?=\s*:(?!\s*50%))/g, "$1inset-inline-start"],
  [/(^|[\s;{])right(?=\s*:)/g, "$1inset-inline-end"],
  [/\btext-align(\s*):(\s*)left\b/g, "text-align$1:$2start"],
  [/\btext-align(\s*):(\s*)right\b/g, "text-align$1:$2end"],
  [/\bfloat(\s*):(\s*)left\b/g, "float$1:$2inline-start"],
  [/\bfloat(\s*):(\s*)right\b/g, "float$1:$2inline-end"],
];

export function toLogical(css) {
  return RULES.reduce((s, [re, to]) => s.replace(re, to), css);
}

/** Line numbers with a left/right-only declaration. */
export function physicalLines(css) {
  return css.split("\n").flatMap((line, i) => (toLogical(line) !== line ? [i + 1] : []));
}

const args = process.argv.slice(2);
const check = args[0] === "--check";
const named = check ? args.slice(1) : args;
// With no files named, every CSS file under src/ except the admin dashboard (English only, D69).
const files = named.length ? named : cssFiles("src");
let found = 0;
for (const file of files) {
  const css = readFileSync(file, "utf8");
  if (check) {
    for (const n of physicalLines(css)) {
      console.error(`${file}:${n}: use a logical property (inline-start/end, inset-inline, text-align: start/end) so Arabic mirrors`);
      found++;
    }
  } else {
    const next = toLogical(css);
    if (next !== css) writeFileSync(file, next);
  }
}
if (check && found) process.exit(1);
