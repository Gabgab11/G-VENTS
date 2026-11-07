// Which edge network serves this request. The website runs on Vercel today and on Cloudflare
// Workers (OpenNext, wrangler.jsonc) after the move; a few request headers mean different things on each.
// workerd always reports this user agent; Node.js on Vercel or `next start` doesn't.
export function onCloudflare(): boolean {
  return globalThis.navigator?.userAgent === "Cloudflare-Workers";
}

type HeaderGetter = (name: string) => string | null;

/**
 * The visitor's country (ISO 3166-1 alpha-2) as the edge network geolocated it, or null.
 * Only the header of the network actually serving the request is read: the other one could have
 * been sent by the visitor. Cloudflare uses XX (unknown) and T1 (Tor) for no country.
 */
export function visitorCountry(get: HeaderGetter, cloudflare = onCloudflare()): string | null {
  const raw = (cloudflare ? get("cf-ipcountry") : get("x-vercel-ip-country"))?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(raw) && raw !== "XX" && raw !== "T1" ? raw : null;
}
