// Static checks on which secrets and variables each workflow job may read. Secrets are
// repository-level (docs/deploy-cloudflare.md §2), so GitHub itself doesn't keep staging jobs away
// from production secrets: this test does, for the workflows in this repository.
//
//   node --test .github/scripts/workflow-secrets.test.mjs
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const refs = (text, kind) => [...text.matchAll(new RegExp(`\\b${kind}\\.([A-Z][A-Z0-9_]*)`, "g"))].map((m) => m[1]);

/** The jobs of a workflow as { name: text }, split at the two-space job keys under `jobs:`. */
function jobs(workflow) {
  const body = workflow.slice(workflow.indexOf("\njobs:\n") + 7);
  const out = {};
  let name = null;
  for (const line of body.split("\n")) {
    const key = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (key) out[(name = key[1])] = "";
    else if (name) out[name] += line + "\n";
  }
  return out;
}

/** Which deployment a job belongs to, from its `if:` branch condition. */
function stage(job) {
  const cond = /^ {4}if:(.*)$/m.exec(job)?.[1] ?? "";
  if (cond.includes("refs/heads/staging")) return "staging";
  if (cond.includes("refs/heads/main")) return "production";
  return "shared";
}

// Production-only secrets, whatever their prefix.
const isProductionSecret = (name) => name.startsWith("PRODUCTION_") || name.startsWith("SUPABASE_PROD_");
// Variables a staging job may read although they're named PRODUCTION_*: public, read-only data.
const PUBLIC_PRODUCTION_VARS = new Set(["PRODUCTION_API_URL"]);
// Secrets a job without a branch condition (ci, notify) may read.
// Read-only, not deploy secrets: CI passes the gventz-api read token to ci.yml; notify posts to Slack.
const SHARED_JOB_SECRETS = new Set(["SLACK_WEBHOOK_URL", "GVENTZ_API_READ_TOKEN"]);

const deploy = jobs(read(".github/workflows/deploy.yml"));

test("deploy.yml has the expected jobs, each tied to one branch or shared", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(deploy).map(([name, job]) => [name, stage(job)])),
    {
      ci: "shared",
      staging: "staging",
      "promotion-gates": "staging",
      "promotion-pr": "staging",
      "production-gates": "production",
      production: "production",
      notify: "shared",
    },
  );
});

test("staging jobs never read production secrets or production-only variables", () => {
  for (const [name, job] of Object.entries(deploy)) {
    if (stage(job) !== "staging") continue;
    for (const s of refs(job, "secrets")) assert.ok(!isProductionSecret(s), `${name} reads secrets.${s}`);
    for (const v of refs(job, "vars")) {
      assert.ok(!v.startsWith("PRODUCTION_") || PUBLIC_PRODUCTION_VARS.has(v), `${name} reads vars.${v}`);
    }
  }
});

test("production jobs never read staging settings", () => {
  for (const [name, job] of Object.entries(deploy)) {
    if (stage(job) !== "production") continue;
    for (const ref of [...refs(job, "secrets"), ...refs(job, "vars")]) {
      assert.ok(!ref.startsWith("STAGING_"), `${name} reads ${ref}`);
    }
  }
});

test("deploy.yml passes ci.yml its secrets explicitly, never with inherit", () => {
  assert.doesNotMatch(read(".github/workflows/deploy.yml"), /secrets:\s*inherit/);
  assert.match(deploy.ci, /GVENTZ_API_READ_TOKEN: \$\{\{ secrets\.GVENTZ_API_READ_TOKEN \}\}/);
});

test("jobs without a branch condition read no deploy secrets", () => {
  for (const [name, job] of Object.entries(deploy)) {
    if (stage(job) !== "shared") continue;
    for (const s of refs(job, "secrets")) assert.ok(SHARED_JOB_SECRETS.has(s), `${name} reads secrets.${s}`);
  }
});

test("no job uses a GitHub environment (branches are the release control, no approval)", () => {
  for (const [name, job] of Object.entries(deploy)) {
    assert.doesNotMatch(job, /^ {4}environment:/m, `${name} uses an environment`);
  }
});

test("the deploy action reads no secrets itself (each job maps its own)", () => {
  const action = read(".github/actions/deploy-website/action.yml");
  assert.deepEqual(refs(action, "secrets"), []);
  assert.deepEqual(refs(action, "vars"), []);
});

test("every secret and variable any workflow uses is documented", () => {
  const docs = read("docs/deploy-cloudflare.md");
  const files = readdirSync(new URL(".github/workflows/", root)).filter((f) => /\.ya?ml$/.test(f));
  for (const file of files) {
    const text = read(`.github/workflows/${file}`);
    for (const name of new Set([...refs(text, "secrets"), ...refs(text, "vars")])) {
      if (name === "GITHUB_TOKEN") continue;
      assert.ok(docs.includes(`\`${name}\``), `${file}: ${name} is missing from docs/deploy-cloudflare.md`);
    }
  }
});
