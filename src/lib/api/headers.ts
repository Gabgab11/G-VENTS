// Headers every server-side call to gventz-api carries (the API's ClientContextResolver): the
// shared BFF key and the visitor's real IP, so per-IP limits see visitors rather than the hosting network.

import { isIP } from "node:net";

export const BFF_KEY_HEADER = "x-gventz-bff-key";
export const CLIENT_IP_HEADER = "x-gventz-client-ip";
export const REQUEST_ID_HEADER = "x-request-id";

/** The visitor's IP from Vercel's `x-forwarded-for` (first entry), or null when unusable. */
export function clientIpFrom(forwardedFor: string | null, realIp: string | null = null): string | null {
  const first = forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "";
  return isIP(first) ? first : null;
}

/**
 * The visitor's IP for the request being served. Vercel overwrites `x-forwarded-for`, so its first
 * entry is the visitor. Cloudflare only appends to a client-sent `x-forwarded-for`, so there the
 * first entry is whatever the visitor typed; Cloudflare's own `cf-connecting-ip` is the only
 * trustworthy source, and nothing else is used (the API's per-IP limits depend on it).
 */
export function clientIpFor(get: (name: string) => string | null, cloudflare: boolean): string | null {
  if (cloudflare) {
    const ip = get("cf-connecting-ip")?.trim() ?? "";
    return isIP(ip) ? ip : null;
  }
  return clientIpFrom(get("x-forwarded-for"), get("x-real-ip"));
}

export function apiHeaders(opts: {
  accessToken: string | null;
  bffKey: string;
  clientIp: string | null;
  requestId: string;
}): Record<string, string> {
  return {
    [REQUEST_ID_HEADER]: opts.requestId,
    ...(opts.accessToken ? { authorization: `Bearer ${opts.accessToken}` } : {}),
    ...(opts.bffKey ? { [BFF_KEY_HEADER]: opts.bffKey } : {}),
    ...(opts.bffKey && opts.clientIp ? { [CLIENT_IP_HEADER]: opts.clientIp } : {}),
  };
}
