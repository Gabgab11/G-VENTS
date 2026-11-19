// Design-token lint (Change 4, FR-28.5, NFR-12). `node scripts/check-design-tokens.mjs` (in `npm run lint`).
// Colours, corner radii and font sizes come from src/design/tokens.css. This finds hard-coded ones
// elsewhere in src/: hex, rgb()/rgba()/hsl()/hsla() colours, and px values in border-radius and
// font-size. Existing pages still have many; they move onto the tokens chunk by chunk, so the check is
// a ratchet: scripts/design-tokens-baseline.json records each file's count, and a file may only go
// down. New files start at zero. `--write-baseline` records the current counts (only after reducing them).
// Marketing art and event themes keep their own colours (D79) and are not checked.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const TOKENS_FILE = "src/design/tokens.css";
export const BASELINE_FILE = "scripts/design-tokens-baseline.json";

/** Files whose own colours are the point: marketing art, event themes, share-card art. */
export const ALLOWED = [
  /^src\/design\/tokens\.css$/,
  /^src\/app\/HeroCards\.tsx$/,
  /^src\/app\/hero-shapes\.ts$/,
  /^src\/app\/home-ball\.css$/,
  /^src\/components\/MirrorBall\.tsx$/,
  /^src\/app\/\(site\)\/sign-in\/SignInArt\.tsx$/,
  /^src\/lib\/themes\.ts$/,
  /\/opengraph-image\.tsx$/,
  /^src\/app\/api\/og\//, // share cards (D81): drawn by next/og, not styled by the site's CSS
  // Places that need literal colours: canvas drawing, QR codes, the browser's theme colour and app
  // manifest, category art, and pages rendered without the site's CSS (global error, maintenance).
  /^src\/components\/ThemeStage\.tsx$/,
  /^src\/lib\/categories\.ts$/,
  /^src\/lib\/qr\.ts$/,
  /^src\/app\/manifest\.ts$/,
  /^src\/app\/RootShell\.tsx$/,
  /^src\/app\/global-error\.tsx$/,
  /^src\/middleware\.ts$/,
  /\.test\.tsx?$/,
  /\.d\.ts$/,
];

const SCANNED = /\.(css|tsx?)$/;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : SCANNED.test(e.name) ? [p] : [];
  });
}

/** Blanks out comments, keeping line breaks so line numbers stay right. */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, pre) => pre + " ".repeat(m.length - pre.length));
}

const RULES = [
  { kind: "colour", re: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g },
  { kind: "colour", re: /\b(?:rgba?|hsla?)\(\s*[\d.]/g },
  { kind: "radius", re: /border(?:-[a-z]+)*-radius\s*:\s*[^;"'`}\n]*\b\d*\.?\d+px/g },
  { kind: "radius", re: /\bborderRadius\s*:\s*(?:\d|["'`][^"'`]*\dpx)/g },
  { kind: "font-size", re: /font-size\s*:\s*[^;"'`}\n]*\b\d*\.?\d+px/g },
  { kind: "font-size", re: /\bfontSize\s*:\s*(?:\d|["'`][^"'`]*\dpx)/g },
  { kind: "font-size", re: /\bfont\s*:\s*[^;"'`}\n]*\b\d*\.?\d+px/g },
];

/** Every hard-coded value in one file's text: [{ line, kind, text }]. */
export function findHardCoded(src) {
  const text = stripComments(src);
  const found = [];
  for (const { kind, re } of RULES) {
    for (const m of text.matchAll(re)) {
      const line = text.slice(0, m.index).split("\n").length;
      found.push({ line, kind, text: m[0].trim().slice(0, 60) });
    }
  }
  return found.sort((a, b) => a.line - b.line);
}

export function isAllowed(path) {
  return ALLOWED.some((re) => re.test(path));
}

/** Compares current counts with the baseline. Returns the files over their allowance. */
export function compare(counts, baseline) {
  return Object.entries(counts)
    .filter(([file, n]) => n > (baseline[file] ?? 0))
    .map(([file, n]) => ({ file, count: n, allowed: baseline[file] ?? 0 }));
}

function main() {
  const args = process.argv.slice(2);
  const files = walk("src").map((f) => relative(".", f).split(sep).join("/")).filter((f) => !isAllowed(f)).sort();
  const counts = {};
  const details = {};
  const totals = { colour: 0, radius: 0, "font-size": 0 };
  for (const file of files) {
    const hits = findHardCoded(readFileSync(file, "utf8"));
    if (!hits.length) continue;
    counts[file] = hits.length;
    details[file] = hits;
    for (const h of hits) totals[h.kind]++;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (args.includes("--write-baseline")) {
    writeFileSync(BASELINE_FILE, JSON.stringify(counts, null, 2) + "\n");
    console.log(`design tokens: baseline written (${total} hard-coded values in ${Object.keys(counts).length} files)`);
    return;
  }
  const baseline = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, "utf8")) : {};
  const over = compare(counts, baseline);
  for (const { file, count, allowed } of over) {
    console.error(`${file}: ${count} hard-coded colours, radii or font sizes (allowed ${allowed}); use the tokens in ${TOKENS_FILE}:`);
    for (const h of details[file]) console.error(`  ${file}:${h.line}: ${h.kind} ${h.text}`);
  }
  const before = Object.values(baseline).reduce((a, b) => a + b, 0);
  console.log(`design tokens: ${total} hard-coded values (colours ${totals.colour}, radii ${totals.radius}, font sizes ${totals["font-size"]}); baseline ${before}`);
  if (over.length) process.exit(1);
  if (total < before) console.log(`design tokens: down ${before - total}. Run with --write-baseline to lock the gain in.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
