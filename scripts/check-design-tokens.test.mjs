// node --test scripts/check-design-tokens.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { findHardCoded, isAllowed, compare, stripComments } from "./check-design-tokens.mjs";

test("finds hex, rgb and hsl colours", () => {
  const hits = findHardCoded(".a { color: #f2a33a; background: rgba(0,0,0,.4); border-color: hsl(10 50% 50%); fill: #fff; }");
  assert.deepEqual(hits.map((h) => h.kind), ["colour", "colour", "colour", "colour"]);
});

test("finds px radii and font sizes, in CSS and in style objects", () => {
  const kinds = (s) => findHardCoded(s).map((h) => h.kind);
  assert.deepEqual(kinds(".a { border-radius: 12px; }"), ["radius"]);
  assert.deepEqual(kinds(".a { border-start-start-radius: 4px; }"), ["radius"]);
  assert.deepEqual(kinds(".a { font-size: 14px; }"), ["font-size"]);
  assert.deepEqual(kinds(".a { font: 600 12px var(--font-sans); }"), ["font-size"]);
  assert.deepEqual(kinds("<div style={{ borderRadius: 8, fontSize: '13px' }} />"), ["radius", "font-size"]);
});

test("tokens, percentages and ems are fine", () => {
  assert.deepEqual(findHardCoded(".a { color: var(--color-text); border-radius: var(--radius-lg); font-size: var(--text-body); }"), []);
  assert.deepEqual(findHardCoded(".a { border-radius: 50%; font-size: 1.2em; }"), []);
});

test("ignores comments, anchors and ids that are not colours", () => {
  assert.deepEqual(findHardCoded("/* was #f2a33a */ .a { color: var(--x); }\n// #fff old\n"), []);
  assert.deepEqual(findHardCoded('<a href="#main-content">Skip</a> <a href="#faq">FAQ</a>'), []);
  assert.equal(stripComments('const u = "https://x.test/a";').includes("https://x.test/a"), true);
});

test("reports line numbers", () => {
  assert.equal(findHardCoded(".a {}\n.b { color: #000; }")[0].line, 2);
});

test("marketing art, event themes and the tokens file are allowed", () => {
  assert.equal(isAllowed("src/design/tokens.css"), true);
  assert.equal(isAllowed("src/lib/themes.ts"), true);
  assert.equal(isAllowed("src/app/HeroCards.tsx"), true);
  assert.equal(isAllowed("src/app/[lang]/e/[slug]/opengraph-image.tsx"), true);
  assert.equal(isAllowed("src/design/components/Button.module.css"), false);
  assert.equal(isAllowed("src/app/globals.css"), false);
});

test("a ratchet: files may go down, never up; new files start at zero", () => {
  const baseline = { "a.css": 5, "b.css": 2 };
  assert.deepEqual(compare({ "a.css": 4, "b.css": 2 }, baseline), []);
  assert.deepEqual(compare({ "a.css": 6 }, baseline), [{ file: "a.css", count: 6, allowed: 5 }]);
  assert.deepEqual(compare({ "new.css": 1 }, baseline), [{ file: "new.css", count: 1, allowed: 0 }]);
});
