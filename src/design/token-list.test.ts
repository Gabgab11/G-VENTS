import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allTokenNames } from "./token-list";

describe("token-list", () => {
  it("names every token in tokens.css, and nothing else", () => {
    const css = readFileSync("src/design/tokens.css", "utf8");
    const declared = new Set([...css.matchAll(/^\s+--([a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
    expect(new Set(allTokenNames())).toEqual(declared);
  });
});
