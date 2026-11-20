import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Real 404s and 308s for host profiles (FR-32), as for events (../../e/[slug]/not-found-status.test.ts):
// generateMetadata resolves before the page streams, so calling notFound() / permanentRedirect() there
// answers with the right status, provided no loading.tsx puts the page inside a Suspense boundary.
// The decisions themselves (unknown, moved, other spelling) are tested in src/lib/host-profile.test.ts.
const app = join(process.cwd(), "src/app/[lang]");
const page = readFileSync(join(app, "h/[handle]/page.tsx"), "utf8");
const between = (from: string, to: string) => page.slice(page.indexOf(from), page.indexOf(to, page.indexOf(from)));

describe("unknown and moved profiles", () => {
  it("has no loading.tsx between the language layout and the profile page", () => {
    for (const p of ["loading.tsx", "h/loading.tsx", "h/[handle]/loading.tsx"]) expect(existsSync(join(app, p)), p).toBe(false);
  });

  it("decides 404 or 308 in one place, used first by the metadata", () => {
    const resolve = between("async function resolve", "\n}\n");
    expect(resolve).toMatch(/notFound\(\)/);
    expect(resolve).toMatch(/permanentRedirect\(`\$\{localizedPath\(profilePath\(outcome\.handle\), lang/);
    const metadata = between("export async function generateMetadata", "\n}\n");
    expect(metadata).toMatch(/await resolve\(params, searchParams\)/);
    expect(between("export default async function", "setRequestLocale")).toMatch(/await resolve\(params, searchParams\)/);
  });
});
