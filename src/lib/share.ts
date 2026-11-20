// Sharing an event (Change 4 chunk 2, FR-29.2): plain share links (no SDKs), the share-card
// address and the `ref=share` marker on shared links.

export type ShareUrls = { whatsapp: string; x: string; facebook: string; email: string };

/** Share links for WhatsApp, X, Facebook and email. */
export function shareUrls(url: string, title: string): ShareUrls {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    email: `mailto:?subject=${t}&body=${encodeURIComponent(`${title}\n\n${url}`)}`,
  };
}

/** The link with `ref=share` set, keeping its other parameters and hash. Works for absolute and relative links. */
export function withRef(url: string): string {
  const absolute = /^[a-z][a-z\d+.-]*:/i.test(url);
  const parsed = new URL(url, "https://share.invalid");
  parsed.searchParams.set("ref", "share");
  return absolute ? parsed.toString() : `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** The event's share card (1200×630); `updatedAt` versions it, so a changed event gets a new card. */
export function shareCardPath(slug: string, updatedAt: string, lang: string): string {
  return `/api/og/e/${encodeURIComponent(slug)}?v=${encodeURIComponent(updatedAt)}&lang=${lang}`;
}
