import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Real 404s (Change 4 chunk 2, Step 11). A loading.tsx above the event or ticket page puts them inside
// a Suspense boundary: the shell streams with status 200 before the page can call notFound(). The
// metadata also calls notFound(), so an unknown slug or code fails before anything is sent. Checked
// against the dev server with curl (see the chunk 2 summary); this guards the structure.
const app = join(process.cwd(), "src/app/[lang]");
const read = (p: string) => readFileSync(join(app, p), "utf8");
const metadataOf = (src: string) => src.slice(src.indexOf("export async function generateMetadata"), src.indexOf("\n}\n", src.indexOf("export async function generateMetadata")));

describe("unknown events and tickets answer 404", () => {
  it("has no loading.tsx between the language layout and the event and ticket pages", () => {
    for (const p of ["loading.tsx", "e/loading.tsx", "e/[slug]/loading.tsx", "t/loading.tsx", "t/[code]/loading.tsx"]) {
      expect(existsSync(join(app, p)), p).toBe(false);
    }
  });

  it("calls notFound() from the event page's metadata", () => {
    expect(metadataOf(read("e/[slug]/page.tsx"))).toMatch(/if \(!event\) notFound\(\)/);
  });

  it("calls notFound() from the ticket page's metadata", () => {
    expect(metadataOf(read("t/[code]/page.tsx"))).toMatch(/notFound\(\)/);
  });

  it("has a branded not-found page for the language pages", () => {
    expect(read("not-found.tsx")).toMatch(/shared\.notFound/);
  });
});
