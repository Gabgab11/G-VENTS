#!/usr/bin/env node
// Prints an environment's `vars` from wrangler.jsonc as KEY=VALUE lines, for $GITHUB_ENV:
//
//   node scripts/cloudflare/wrangler-vars.mjs staging >> "$GITHUB_ENV"
//
// The deploy workflow builds with exactly the values the Worker runs with, so NEXT_PUBLIC_* that
// Next.js inlines at build time can't disagree with the runtime vars. Fails on an unknown
// environment, a non-string value, or a value with a newline (which could inject extra lines).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/** JSONC to JSON: drops // and /* *\/ comments and trailing commas, leaving strings untouched. */
export function stripJsonc(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 1;
    } else {
      out += c;
    }
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

export function varsFor(config, envName) {
  const env = config.env?.[envName];
  if (!env) throw new Error(`wrangler.jsonc has no environment "${envName}"`);
  const vars = env.vars ?? {};
  for (const [key, value] of Object.entries(vars)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new Error(`var name ${key} is not UPPER_SNAKE_CASE`);
    if (typeof value !== "string" || /[\r\n]/.test(value)) throw new Error(`var ${key} must be a one-line string`);
  }
  return vars;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [envName, file = "wrangler.jsonc"] = process.argv.slice(2);
  if (!envName) {
    console.error("usage: wrangler-vars.mjs <environment> [wrangler.jsonc]");
    process.exit(2);
  }
  const vars = varsFor(JSON.parse(stripJsonc(await readFile(file, "utf8"))), envName);
  for (const [key, value] of Object.entries(vars)) console.log(`${key}=${value}`);
}
