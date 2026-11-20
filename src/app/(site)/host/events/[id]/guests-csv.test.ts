import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COLUMNS, ENGLISH_COLUMNS, translateHeader } from "./guests-csv";

const API_EXPORT = "/Users/payazaafrica/gventz-api/src/modules/ticketing/application/guest-export.service.ts";

async function read(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(await new Response(stream).arrayBuffer());
}

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({ start(c) { for (const s of chunks) c.enqueue(enc.encode(s)); c.close(); } });
}

describe("guests.csv header", () => {
  it("one translation id per fixed column, in the API's order", () => {
    expect(COLUMNS).toHaveLength(ENGLISH_COLUMNS.length);
    expect(ENGLISH_COLUMNS.slice(4, 8)).toEqual(["Buyer email", "Buyer phone", "Buyer gender", "Recipient email"]);
    const en = JSON.parse(readFileSync(join(process.cwd(), "messages/en/dashboard.json"), "utf8")).csv.header;
    expect(COLUMNS.map((c) => en[c])).toEqual(ENGLISH_COLUMNS);
  });

  it.runIf((() => { try { readFileSync(API_EXPORT); return true; } catch { return false; } })())("matches gventz-api's export header", () => {
    const source = readFileSync(API_EXPORT, "utf8");
    const header = /const header = \[([^\]]*)/.exec(source)![1]!;
    const names = [...header.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(names).toEqual(ENGLISH_COLUMNS);
  });

  it("replaces only the fixed part of the first line, across chunks", async () => {
    const english = `﻿${ENGLISH_COLUMNS.join(",")},Company\nabc,1\n`;
    const translated = COLUMNS.map((c) => `T:${c}`);
    const out = await read(translateHeader(streamOf(english.slice(0, 20), english.slice(20)), translated));
    expect(out).toBe(`﻿${translated.join(",")},Company\nabc,1\n`);
  });

  it("leaves an unexpected header alone", async () => {
    const other = "Something,Else\n1,2\n".repeat(20);
    expect(await read(translateHeader(streamOf(other), COLUMNS.map(String)))).toBe(other);
  });
});
