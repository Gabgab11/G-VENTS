import "server-only";

// Fonts for the share cards (D81), from the pinned @fontsource packages: static .woff (the card
// renderer reads woff and ttf, not woff2), embedded as base64 modules by generate.mjs so they load
// the same way under next dev, next start and the Cloudflare Worker (which has no file system).
// Each subset is its own family name; card.tsx lists them in fallback order.
// Arabic text uses IBM Plex Sans Arabic: Manrope and Bricolage have no Arabic glyphs, and Noto Sans
// Arabic uses OpenType lookups the renderer can't read (it fails the whole image). It is loaded
// only for cards with Arabic text. Chinese falls back to the renderer's own font download.

type Weight = 400 | 700 | 800;
export type CardFont = { name: string; data: ArrayBuffer; weight: Weight; style: "normal" };

const SOURCES = {
  "bricolage-latin-800": () => import("./bricolage-latin-800"),
  "bricolage-latin-ext-800": () => import("./bricolage-latin-ext-800"),
  "manrope-latin-400": () => import("./manrope-latin-400"),
  "manrope-latin-ext-400": () => import("./manrope-latin-ext-400"),
  "manrope-latin-700": () => import("./manrope-latin-700"),
  "manrope-latin-ext-700": () => import("./manrope-latin-ext-700"),
  "plex-arabic-400": () => import("./plex-arabic-400"),
  "plex-arabic-700": () => import("./plex-arabic-700"),
};
type Key = keyof typeof SOURCES;

function decode(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Decoded once per isolate (Worker) or process.
const cache = new Map<Key, Promise<ArrayBuffer>>();
function load(key: Key): Promise<ArrayBuffer> {
  let p = cache.get(key);
  if (!p) {
    p = SOURCES[key]().then((m) => decode(m.default));
    cache.set(key, p);
  }
  return p;
}

export async function cardFonts(opts: { arabic?: boolean } = {}): Promise<CardFont[]> {
  const spec: [Key, string, Weight][] = [
    ["bricolage-latin-800", "Bricolage", 800],
    ["bricolage-latin-ext-800", "Bricolage Ext", 800],
    ["manrope-latin-400", "Manrope", 400],
    ["manrope-latin-ext-400", "Manrope Ext", 400],
    ["manrope-latin-700", "Manrope", 700],
    ["manrope-latin-ext-700", "Manrope Ext", 700],
    ...(opts.arabic
      ? ([
          ["plex-arabic-400", "Arabic", 400],
          ["plex-arabic-700", "Arabic", 700],
          ["plex-arabic-700", "Arabic", 800],
        ] as [Key, string, Weight][])
      : []),
  ];
  return Promise.all(spec.map(async ([key, name, weight]) => ({ name, data: await load(key), weight, style: "normal" as const })));
}
