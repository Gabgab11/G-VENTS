import "server-only";

import { randomUUID } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { apiHeaders, clientIpFor } from "@/lib/api/headers";
import { onCloudflare } from "@/lib/platform";
import { cardApiPath, cardLanguage, movedCardPath, type ShareCard } from "@/lib/share-card-path";

// The share cards (Change 4, FR-29.1, D81) are drawn by gventz-api since the website moved to
// Cloudflare Workers Free (next/og's renderer didn't fit the Worker's 3 MiB limit). The website
// keeps their addresses (/api/og/e/{slug}, /api/og/site), so links already shared and the og:image
// in every page's metadata keep working: these routes fetch the PNG from the API and pass it on,
// with the API's status and cache headers. On Cloudflare the answer is also kept in the edge cache
// (caches.default), so a link posted in a busy group chat reaches the API once per colo.

const TIMEOUT_MS = 8_000;

type EdgeCache = { match(key: Request): Promise<Response | undefined>; put(key: Request, value: Response): Promise<void> };

/** Cloudflare's default cache in a Worker; undefined under Node (next dev, next start). */
function edgeCache(): EdgeCache | undefined {
  return (globalThis as { caches?: { default?: EdgeCache } }).caches?.default;
}

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60", "Content-Type": "text/plain; charset=utf-8" } });
}

/**
 * The card for this request (an event's by slug, a host's by handle, or the site card) from the API.
 * A host card for an old handle comes back as a 308 to the new handle's /api/og/h/… address.
 */
export async function proxyShareCard(request: Request, card: ShareCard): Promise<Response> {
  const search = new URL(request.url).searchParams;
  const lang = cardLanguage(search.get("lang"));
  const version = search.get("v");
  const path = cardApiPath(card, lang, version);
  if (!path) return notFound();

  const cache = edgeCache();
  // One cache entry per card, whatever else the address carried.
  const key = new Request(new URL(`/api/og/cache${path}`, request.url).toString());
  if (cache) {
    const hit = await cache.match(key).catch(() => undefined);
    if (hit) return hit;
  }

  let upstream: Response;
  try {
    const env = serverEnv();
    upstream = await fetch(`${env.apiUrl}${path}`, {
      headers: apiHeaders({ accessToken: null, bffKey: env.bffSharedSecret, clientIp: clientIpFor((name) => request.headers.get(name), onCloudflare()), requestId: randomUUID() }),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    console.error(`[og] share card from the API failed: ${(error as Error).message}`);
    return new Response("Share card unavailable", { status: 502, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (upstream.status === 404) return notFound();
  if (upstream.status >= 300 && upstream.status < 400) {
    const moved = card.kind === "host" ? movedCardPath(upstream.headers.get("location"), path, new URL(request.url).search) : null;
    if (moved) return new Response(null, { status: 308, headers: { Location: moved, "Cache-Control": "public, max-age=300" } });
    console.error(`[og] share card from the API answered ${upstream.status} without a card address`);
    return new Response("Share card unavailable", { status: 502, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (!upstream.ok || upstream.headers.get("content-type") !== "image/png") {
    console.error(`[og] share card from the API answered ${upstream.status}`);
    return new Response("Share card unavailable", { status: 502, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });
  }

  const png = await upstream.arrayBuffer();
  const response = new Response(png, {
    status: 200,
    headers: { "Content-Type": "image/png", "Cache-Control": upstream.headers.get("cache-control") ?? "public, max-age=3600" },
  });
  if (cache) await cache.put(key, response.clone()).catch(() => undefined);
  return response;
}
