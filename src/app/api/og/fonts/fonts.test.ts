import { describe, expect, it } from "vitest";
import { FONT_FILES, fontBase64 } from "./generate.mjs";

describe("share card fonts", () => {
  it.each(Object.entries(FONT_FILES))("%s matches the installed @fontsource file (run generate.mjs after a version bump)", async (name, file) => {
    const embedded = (await import(`./${name}.ts`)).default as string;
    expect(embedded).toBe(fontBase64(file));
    // wOFF signature
    expect(Buffer.from(embedded, "base64").subarray(0, 4).toString("latin1")).toBe("wOFF");
  });
});
