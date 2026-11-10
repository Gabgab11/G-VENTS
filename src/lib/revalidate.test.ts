import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { allowedPaths, verifySignature } from "./revalidate";

const SECRET = "r".repeat(40);
const sign = (body: string, ts: number, secret = SECRET) => createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

describe("verifySignature (same rule as gventz-api)", () => {
  const body = JSON.stringify({ paths: ["/e/party-x1y2z", "/", "/discover"] });
  const ts = 1_800_000_000;

  it("accepts a fresh, correctly signed call", () => {
    expect(verifySignature(SECRET, body, ts, sign(body, ts), ts + 60)).toBe(true);
  });

  it("refuses changed bodies, wrong secrets, stale times, junk signatures and short secrets", () => {
    expect(verifySignature(SECRET, `${body} `, ts, sign(body, ts), ts)).toBe(false);
    expect(verifySignature(SECRET, body, ts, sign(body, ts, "x".repeat(40)), ts)).toBe(false);
    expect(verifySignature(SECRET, body, ts, sign(body, ts), ts + 301)).toBe(false);
    expect(verifySignature(SECRET, body, ts, "not-hex", ts)).toBe(false);
    expect(verifySignature("short", body, ts, sign(body, ts, "short"), ts)).toBe(false);
    expect(verifySignature(SECRET, body, Number.NaN, sign(body, ts), ts)).toBe(false);
  });
});

describe("allowedPaths", () => {
  it("allows only the public pages", () => {
    expect(allowedPaths(JSON.stringify({ paths: ["/e/party-x1y2z", "/", "/discover"] }))).toEqual(["/e/party-x1y2z", "/", "/discover"]);
    expect(allowedPaths(JSON.stringify({ paths: ["/dashboard"] }))).toBeNull();
    expect(allowedPaths(JSON.stringify({ paths: ["/e/../dashboard"] }))).toBeNull();
    expect(allowedPaths(JSON.stringify({ paths: [] }))).toBeNull();
    expect(allowedPaths("nope")).toBeNull();
  });
});
