// Headers every server-side call to gventz-api carries (the API's ClientContextResolver): the
// shared BFF key and the visitor's real IP, so per-IP limits see visitors rather than Vercel.

import { isIP } from "node:net";

export const BFF_KEY_HEADER = "x-gventz-bff-key";
export const CLIENT_IP_HEADER = "x-gventz-client-ip";
export const REQUEST_ID_HEADER = "x-request-id";

/** The visitor's IP from Vercel's `x-forwarded-for` (first entry), or null when unusable. */
export function clientIpFrom(forwardedFor: string | null, realIp: string | null = null): string | null {
  const first = forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "";
  return isIP(first) ? first : null;
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
