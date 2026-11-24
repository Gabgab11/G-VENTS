import "server-only";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/env";
import { onCloudflare } from "@/lib/platform";
import { apiHeaders, clientIpFor } from "@/lib/api/headers";
import { normalizeResults, type SearchResults } from "./types";

/** The API's answer could not be had (down, rate-limited, or the endpoint is not deployed yet). */
export class SearchUnavailable extends Error {
  constructor(readonly status: number) {
    super(`search unavailable (${status})`);
  }
}

/**
 * Public search through gventz-api (GET /v1/search), server-side only (AD13: the browser never calls
 * the API). Anonymous, but it forwards the visitor's IP so the API's per-IP limit sees visitors.
 * The endpoint is not in the generated schema yet, so this is a plain fetch with the BFF headers.
 */
export async function searchApi(q: string, lang: string, limit: number): Promise<SearchResults> {
  const env = serverEnv();
  const incoming = await headers();
  const url = new URL("/v1/search", env.apiUrl);
  url.searchParams.set("q", q);
  url.searchParams.set("lang", lang);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url, {
    headers: apiHeaders({
      accessToken: null,
      bffKey: env.bffSharedSecret,
      clientIp: clientIpFor((name) => incoming.get(name), onCloudflare()),
      requestId: incoming.get("x-request-id") ?? randomUUID(),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new SearchUnavailable(res.status);
  return normalizeResults(await res.json());
}
