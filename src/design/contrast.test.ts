import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Parses tokens.css and checks every text/ground pair the spec names, in both themes (WCAG 2.x).
const css = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** The declarations of the first rule whose selector (whitespace-normalised) passes `match`. */
function block(name: string, match: (selector: string) => boolean): Record<string, string> {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    if (match(norm(m[1]))) {
      return Object.fromEntries(
        m[2]
          .split(";")
          .map((d) => d.trim())
          .filter((d) => d.startsWith("--"))
          .map((d) => {
            const i = d.indexOf(":");
            return [d.slice(0, i).trim(), d.slice(i + 1).trim()];
          }),
      );
    }
  }
  throw new Error(`No ${name} rule in tokens.css`);
}

// Selectors are matched loosely (`:root, [data-theme="dark"]` or `:root, :root[data-theme="dark"]`).
const base = block("base", (s) => s === ":root");
const darkBlock = block("dark", (s) => s.startsWith(":root,") && s.includes('[data-theme="dark"]'));
const lightBlock = block("light", (s) => /^(:root)?\[data-theme="light"\]$/.test(s));
const mediaLight = block("prefers-color-scheme: light", (s) => s.includes(":not([data-theme])"));
const dark = { ...base, ...darkBlock };
const light = { ...dark, ...lightBlock };

function resolve(theme: Record<string, string>, name: string, depth = 0): string {
  const value = theme[name];
  if (value === undefined) throw new Error(`Unknown token ${name}`);
  const alias = value.match(/^var\((--[\w-]+)\)$/);
  if (alias) {
    if (depth > 10) throw new Error(`Alias loop at ${name}`);
    return resolve(theme, alias[1], depth + 1);
  }
  return value;
}

function luminance(hex: string): number {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`Not a 6-digit hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const grounds = ["bg", "surface", "surface-raised"];
const pairs: Array<[fg: string, bg: string, min: number]> = [
  ...["text", "text-soft", "text-muted", "accent"].flatMap((fg) => grounds.map((bg): [string, string, number] => [fg, bg, 4.5])),
  ["on-accent", "accent", 4.5],
  ["on-inverse", "inverse", 4.5],
  ["accent-text", "accent-soft", 4.5],
  ["success", "surface", 4.5],
  ["warning", "surface", 4.5],
  ["danger", "surface", 4.5],
  ["info", "surface", 4.5],
  ["border-strong", "surface", 3],
  ["focus", "bg", 3],
  ["focus", "surface", 3],
  ["brand-z", "bg", 3],
];

describe("tokens.css contrast", () => {
  it("sanity: black on white is 21:1", () => {
    expect(ratio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  for (const [themeName, theme] of [["dark", dark], ["light", light]] as const) {
    describe(themeName, () => {
      it.each(pairs)(`--color-%s on --color-%s is at least %s:1`, (fg, bg, min) => {
        const r = ratio(resolve(theme, `--color-${fg}`), resolve(theme, `--color-${bg}`));
        expect(r, `${themeName}: ${fg} on ${bg} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(min);
      });
    });
  }

  it("the light block and the prefers-color-scheme: light block are identical", () => {
    expect(mediaLight).toEqual(lightBlock);
  });
});
