import type { CookieOptionsWithName } from "@supabase/ssr";

// Settings shared by every server-side Supabase client (Server Components, Server Actions, Route
// Handlers and the middleware). No "server-only" import: the middleware uses this file too.
//
// Rate limits: Supabase Auth limits code checks (/verify) and session refreshes (/token) per IP.
// Every call now comes from the Worker, so without help all visitors would share one bucket. With a
// secret API key and IP Address Forwarding turned on (Authentication > Rate Limits), Supabase uses
// the IP in `sb-forwarded-for` instead. Publishable/anon keys can't forward, so the header is sent
// only with the secret key. Only Cloudflare's own `cf-connecting-ip` is trusted, never a
// visitor-sent `x-forwarded-for`.

type HeaderGetter = (name: string) => string | null;

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HEX_GROUP = /^[0-9a-f]{1,4}$/i;

/** IPv6 in any standard form (`::` shortening, an IPv4 tail), no zone, port or brackets. */
function isIpv6(value: string): boolean {
  if (value.length > 45 || !value.includes(":")) return false;
  let groups = value;
  let tail = 0;
  const lastColon = value.lastIndexOf(":");
  if (value.slice(lastColon + 1).includes(".")) {
    if (!IPV4.test(value.slice(lastColon + 1))) return false;
    groups = value.slice(0, lastColon + 1) + "0";
    tail = 1; // the IPv4 tail fills two groups; the placeholder above counts as one
  }
  const halves = groups.split("::");
  if (halves.length > 2) return false;
  const parts = halves.map((h) => (h === "" ? [] : h.split(":")));
  if (!parts.every((p) => p.every((g) => HEX_GROUP.test(g)))) return false;
  const count = parts.reduce((n, p) => n + p.length, 0) + tail;
  return halves.length === 2 ? count <= 7 : count === 8;
}

/** True for a plain IPv4 or IPv6 address (no port, zone or brackets). */
export function isIpAddress(value: string): boolean {
  return IPV4.test(value) || isIpv6(value);
}

/** The visitor's IP as Cloudflare saw it, or null off Cloudflare or when the header is unusable. */
export function forwardedIp(get: HeaderGetter, cloudflare: boolean): string | null {
  if (!cloudflare) return null;
  const ip = get("cf-connecting-ip")?.trim() ?? "";
  return isIpAddress(ip) ? ip : null;
}

/**
 * Which key the server client uses, and the headers it adds. The secret key (server-only, never
 * NEXT_PUBLIC_) is used when set; without it the client behaves as before (publishable key, no
 * forwarding), so a deploy without the secret still works.
 */
export function supabaseKeyAndHeaders(opts: {
  secretKey: string;
  publishableKey: string;
  ip: string | null;
}): { key: string; headers: Record<string, string> } {
  if (!opts.secretKey) return { key: opts.publishableKey, headers: {} };
  return { key: opts.secretKey, headers: opts.ip ? { "sb-forwarded-for": opts.ip } : {} };
}

/**
 * Session cookie flags. Nothing in the browser reads the session (sign-in runs on the server), so
 * the cookie is httpOnly; secure whenever the site is https (everywhere but localhost).
 */
export function authCookieOptions(siteUrl: string): CookieOptionsWithName {
  return { path: "/", sameSite: "lax", httpOnly: true, secure: siteUrl.startsWith("https://") };
}
