// Registration link tokens on the public pages (Change 6, FR-44). A segment link is shared as
// `/e/<slug>?r=<token>`; the token scopes which tiers and questions show and, when the link or event
// has an access code, drives the unlock gate. Pure helpers, so they're unit-tested; the unlock token
// itself is kept in an httpOnly cookie set by the unlock server action, never in the URL.

// Link tokens are hex(16) = 32 chars today; allow a safe range so rotated or future tokens still pass.
const TOKEN = /^[A-Za-z0-9_-]{8,128}$/;

/** A link token as it may appear in `?r=` (first value when repeated); null when absent or malformed. */
export function tokenParam(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && TOKEN.test(value) ? value : null;
}

/** A path with `?r=<token>` added when there is a token. */
export function withToken(path: string, token: string | null | undefined): string {
  if (!token) return path;
  return `${path}${path.includes("?") ? "&" : "?"}r=${encodeURIComponent(token)}`;
}

/** The httpOnly cookie that holds the unlock proof for one event + link, so a reload skips the gate. */
export function unlockCookieName(eventId: string, linkToken: string): string {
  return `gv_unlock_${eventId}_${linkToken}`;
}
