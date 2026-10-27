#!/usr/bin/env node
// Checks that a deployed gventz-api still serves the contract this website was built against.
//
//   node .github/scripts/check-api-contract.mjs <pinned openapi.json> <deployed openapi.json>
//
// Both arguments are a file path or an http(s) URL. Fails (exit 1) on what would break the
// website: an operation it may call is missing, the API now requires a parameter or request-body
// field the website doesn't send, or a success status the website handles was removed. Additions
// are fine: the API may be ahead of the website, never behind it.
import { readFile } from 'node:fs/promises';

const METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options'];

async function load(source) {
  if (!/^https?:\/\//.test(source)) return JSON.parse(await readFile(source, 'utf8'));
  const res = await fetch(source, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${source} answered ${res.status}`);
  return res.json();
}

// `/v1/events/{id}` and `/v1/events/{eventId}` are the same route.
const routeKey = (path) => path.replace(/\{[^}]+\}/g, '{}');

function resolve(doc, node) {
  let current = node;
  for (let i = 0; current && current.$ref && i < 20; i++) {
    current = current.$ref.replace(/^#\//, '').split('/').reduce((n, key) => n?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], doc);
  }
  return current ?? {};
}

function operations(doc) {
  const ops = new Map();
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of METHODS) {
      if (item[method]) ops.set(`${method.toUpperCase()} ${routeKey(path)}`, { path, item, op: item[method] });
    }
  }
  return ops;
}

function requiredParams(doc, { item, op }) {
  const params = [...(item.parameters ?? []), ...(op.parameters ?? [])].map((p) => resolve(doc, p));
  // Path parameters are positional (the route key already matches them), so only names in query/header/cookie count.
  return new Set(params.filter((p) => p.required && p.in !== 'path').map((p) => `${p.in}:${p.name}`));
}

function requiredBodyFields(doc, { op }) {
  const body = resolve(doc, op.requestBody);
  const schema = resolve(doc, body.content?.['application/json']?.schema);
  return { required: Boolean(body.required), fields: new Set(schema.required ?? []) };
}

const successStatuses = ({ op }) => Object.keys(op.responses ?? {}).filter((s) => /^2/.test(s));

export function compare(pinned, deployed) {
  const problems = [];
  const live = operations(deployed);
  for (const [key, want] of operations(pinned)) {
    const have = live.get(key);
    const name = `${key.split(' ')[0]} ${want.path}`;
    if (!have) {
      problems.push(`${name}: missing from the deployed API`);
      continue;
    }
    const sent = requiredParams(pinned, want);
    for (const param of requiredParams(deployed, have)) {
      if (!sent.has(param)) problems.push(`${name}: now requires ${param.replace(':', ' parameter ')}`);
    }
    const wantBody = requiredBodyFields(pinned, want);
    const haveBody = requiredBodyFields(deployed, have);
    if (haveBody.required && !wantBody.required && !want.op.requestBody) problems.push(`${name}: now requires a request body`);
    for (const field of haveBody.fields) {
      if (!wantBody.fields.has(field)) problems.push(`${name}: request body now requires "${field}"`);
    }
    const statuses = new Set(successStatuses(have));
    for (const status of successStatuses(want)) {
      if (!statuses.has(status)) problems.push(`${name}: no longer answers ${status}`);
    }
  }
  return { problems, checked: operations(pinned).size };
}

async function main() {
  const [pinnedSource, deployedSource] = process.argv.slice(2);
  if (!pinnedSource || !deployedSource) {
    console.error('usage: check-api-contract.mjs <pinned openapi.json> <deployed openapi.json>');
    process.exit(2);
  }
  const [pinned, deployed] = await Promise.all([load(pinnedSource), load(deployedSource)]);
  const { problems, checked } = compare(pinned, deployed);
  console.log(`Pinned contract ${pinned.info?.version ?? '?'} vs deployed API ${deployed.info?.version ?? '?'}: ${checked} operations checked.`);
  if (problems.length === 0) {
    console.log('The deployed API serves everything the website uses.');
    return;
  }
  for (const problem of problems) console.log(`::error::${problem}`);
  console.log(`${problems.length} incompatibilit${problems.length === 1 ? 'y' : 'ies'}: release the API first, or pin the website to the API that is live.`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.log(`::error::Couldn't compare API contracts: ${error.message}`);
    process.exit(1);
  });
}
