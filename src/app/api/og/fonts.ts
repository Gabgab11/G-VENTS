import "server-only";

import { onCloudflare } from "@/lib/platform";

// Fonts for the share cards (D81): static .woff files from the pinned @fontsource packages (the
// card renderer reads woff and ttf, not woff2). `new URL(..., import.meta.url)` makes the bundler
// copy each file into the build's static files (/_next/static/media/...), not into the Worker
// bundle. They are then read without a network trip: from the Worker's static assets (ASSETS
// binding) on Cloudflare, from the build folder under Node.js (next dev, next start).
// Arabic text uses IBM Plex Sans Arabic (Manrope and Bricolage have no Arabic glyphs; Noto Sans Arabic
// uses OpenType lookups the renderer can't read and fails the whole image). It is loaded only
// for cards that contain Arabic. Chinese falls back to the renderer's own font download.

type Weight = 400 | 700 | 800;
export type CardFont = { name: string; data: ArrayBuffer; weight: Weight; style: "normal" };

const FILES = {
  bricolage800: new URL("../../../../node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff", import.meta.url),
  bricolageExt800: new URL("../../../../node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-ext-800-normal.woff", import.meta.url),
  manrope400: new URL("../../../../node_modules/@fontsource/manrope/files/manrope-latin-400-normal.woff", import.meta.url),
  manropeExt400: new URL("../../../../node_modules/@fontsource/manrope/files/manrope-latin-ext-400-normal.woff", import.meta.url),
  manrope700: new URL("../../../../node_modules/@fontsource/manrope/files/manrope-latin-700-normal.woff", import.meta.url),
  manropeExt700: new URL("../../../../node_modules/@fontsource/manrope/files/manrope-latin-ext-700-normal.woff", import.meta.url),
  arabic400: new URL("../../../../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff", import.meta.url),
  arabic700: new URL("../../../../node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff", import.meta.url),
};

/** The file's path under the site (/_next/static/media/...), however the bundler represents the URL. */
function sitePath(url: URL | string): string {
  return new URL(String(url), "https://assets.invalid").pathname;
}

async function readAsset(url: URL): Promise<ArrayBuffer> {
  const path = sitePath(url);
  if (onCloudflare()) {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const assets = (env as unknown as { ASSETS: { fetch: (input: string) => Promise<Response> } }).ASSETS;
    const res = await assets.fetch(`https://assets.invalid${path}`);
    if (!res.ok) throw new Error(`[og] font ${path}: ${res.status}`);
    return res.arrayBuffer();
  }
  // Node.js: the bundler copied the file into .next/static/media (production builds) or
  // .next/server/static/media (next dev).
  const [{ readFile }, { join }] = await Promise.all([import("node:fs/promises"), import("node:path")]);
  const rel = decodeURIComponent(path.replace(/^\/_next\//, ""));
  const file = await readFile(join(process.cwd(), ".next", rel)).catch(() => readFile(join(process.cwd(), ".next", "server", rel)));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
}

// Loaded once per isolate (Worker) or process.
const cache = new Map<keyof typeof FILES, Promise<ArrayBuffer>>();
function load(key: keyof typeof FILES): Promise<ArrayBuffer> {
  let p = cache.get(key);
  if (!p) {
    p = readAsset(FILES[key]);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export async function cardFonts(opts: { arabic?: boolean } = {}): Promise<CardFont[]> {
  const spec: [keyof typeof FILES, string, Weight][] = [
    ["bricolage800", "Bricolage", 800],
    ["bricolageExt800", "Bricolage Ext", 800],
    ["manrope400", "Manrope", 400],
    ["manropeExt400", "Manrope Ext", 400],
    ["manrope700", "Manrope", 700],
    ["manropeExt700", "Manrope Ext", 700],
    ...(opts.arabic
      ? ([
          ["arabic400", "Arabic", 400],
          ["arabic700", "Arabic", 700],
          ["arabic700", "Arabic", 800],
        ] as [keyof typeof FILES, string, Weight][])
      : []),
  ];
  return Promise.all(spec.map(async ([key, name, weight]) => ({ name, data: await load(key), weight, style: "normal" as const })));
}
