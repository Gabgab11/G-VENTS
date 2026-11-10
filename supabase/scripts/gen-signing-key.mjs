// Writes supabase/signing_keys.json: one ES256 key for local Supabase Auth, so local access tokens
// are signed asymmetrically like production (O17) and gventz-api (ES256/RS256 only) accepts them.
// Local and CI only; the file is gitignored. Usage: node supabase/scripts/gen-signing-key.mjs
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const target = new URL("../signing_keys.json", import.meta.url);
if (existsSync(target) && !process.argv.includes("--force")) {
  console.log("supabase/signing_keys.json already exists (use --force to replace it)");
  process.exit(0);
}
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = { ...privateKey.export({ format: "jwk" }), kid: randomUUID(), use: "sig", key_ops: ["sign", "verify"], alg: "ES256", ext: true };
writeFileSync(target, JSON.stringify([jwk], null, 2) + "\n", { mode: 0o600 });
console.log("wrote supabase/signing_keys.json");
