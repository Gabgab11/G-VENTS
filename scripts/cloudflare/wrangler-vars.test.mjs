import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { stripJsonc, varsFor } from "./wrangler-vars.mjs";

test("strips comments and trailing commas but not // inside strings", () => {
  const text = `{
    // a comment
    "url": "https://api.gventz.com", /* block */
    "list": [1, 2,],
  }`;
  assert.deepEqual(JSON.parse(stripJsonc(text)), { url: "https://api.gventz.com", list: [1, 2] });
});

test("refuses unknown environments and unsafe values", () => {
  assert.throws(() => varsFor({ env: {} }, "staging"), /no environment/);
  assert.throws(() => varsFor({ env: { s: { vars: { A: "x\nB=y" } } } }, "s"), /one-line/);
  assert.throws(() => varsFor({ env: { s: { vars: { A: 1 } } } }, "s"), /one-line/);
});

// The API each environment talks to: staging must never point at the production API, or the reverse.
test("wrangler.jsonc wires each environment to its own API and site", async () => {
  const config = JSON.parse(stripJsonc(await readFile(new URL("../../wrangler.jsonc", import.meta.url), "utf8")));
  assert.equal(varsFor(config, "staging").API_URL, "https://api-staging.gventz.com");
  assert.equal(varsFor(config, "staging").NEXT_PUBLIC_SITE_URL, "https://staging.gventz.com");
  assert.equal(varsFor(config, "production").API_URL, "https://api.gventz.com");
  assert.equal(varsFor(config, "production").NEXT_PUBLIC_SITE_URL, "https://gventz.com");
  for (const name of ["staging", "production"]) {
    const env = config.env[name];
    assert.ok(env.r2_buckets?.some((b) => b.binding === "NEXT_INC_CACHE_R2_BUCKET"), `${name}: R2 cache binding`);
    assert.equal(env.services?.[0]?.service, env.name, `${name}: WORKER_SELF_REFERENCE points at itself`);
  }
  assert.notEqual(config.env.staging.r2_buckets[0].bucket_name, config.env.production.r2_buckets[0].bucket_name);
});
