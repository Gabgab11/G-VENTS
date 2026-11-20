// Host profiles (Change 4 chunk 4, FR-32, D83): the pure rules the website shares between the public
// profile (/h/{handle}), Settings → Profile and the Follow button. The API is the authority (it
// normalises and checks everything again); these only let the page answer before a round trip.

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;
export const BIO_MAX = 280;
export const LOCATION_MAX = 120;

/** The API's reserved words (gventz-api hosts/domain/handle.ts), compared after normalising. */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  "admin", "api", "host", "hosts", "h", "e", "t", "discover", "pricing", "help", "terms", "privacy", "refunds",
  "sign-in", "sign-up", "dashboard", "account", "settings", "support", "gventz", "g-ventz", "staff", "about", "me", "null", "undefined",
]);

const FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** As the API stores it: NFKC, trimmed, one leading "@" dropped, lower-case. Idempotent. */
export function normalizeHandle(raw: string): string {
  const s = raw.normalize("NFKC").trim();
  return (s.startsWith("@") ? s.slice(1) : s).trim().toLowerCase();
}

export type HandleProblem = "invalid" | "reserved";

/** Whether a typed handle can be chosen: null when it can (the API still decides whether it's free). */
export function handleProblem(raw: string): HandleProblem | null {
  const handle = normalizeHandle(raw);
  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX || !FORMAT.test(handle)) return "invalid";
  return RESERVED_HANDLES.has(handle) ? "reserved" : null;
}

/** The profile's address without a language prefix. */
export const profilePath = (handle: string) => `/h/${encodeURIComponent(handle)}`;

/** Where a profile request should go: a 404, a 308 to the current handle, or the page itself. */
export type ProfileOutcome = { kind: "notFound" } | { kind: "redirect"; handle: string } | { kind: "show" };

/**
 * An unknown handle is a 404; an old handle (`movedTo`) or a different spelling of the current one
 * ("AdaEvents", "@ada-events") moves permanently to the handle as stored.
 */
export function profileOutcome(profile: { handle: string; movedTo: string | null } | null, requested: string): ProfileOutcome {
  if (!profile || !profile.handle) return { kind: "notFound" };
  if (profile.movedTo) return { kind: "redirect", handle: profile.movedTo };
  let asTyped = requested;
  try {
    asTyped = decodeURIComponent(requested);
  } catch {
    // Keep it as it came.
  }
  return asTyped === profile.handle ? { kind: "show" } : { kind: "redirect", handle: profile.handle };
}

// ── Social links ────────────────────────────────────────────────────────────────────────────────

export type SocialField = "instagram" | "facebook" | "x" | "website";
export const SOCIAL_FIELDS: readonly SocialField[] = ["instagram", "facebook", "x", "website"];

const SOCIAL_SITE: Record<Exclude<SocialField, "website">, string> = { instagram: "instagram.com", facebook: "facebook.com", x: "x.com" };

/**
 * What the host typed, made into what the API accepts: a bare handle ("@adaevents", "adaevents") on
 * Instagram, Facebook or X becomes that network's link; links (with or without https://) and the
 * website go as typed, for the API to check and normalise. Empty clears the field (null).
 */
export function socialInput(field: SocialField, typed: string): string | null {
  const value = typed.trim();
  if (!value) return null;
  if (field === "website") return value;
  const bare = /^@?([A-Za-z0-9._-]{1,100})$/.exec(value);
  if (bare) {
    const name = bare[1]!;
    // Instagram names may contain dots ("ada.events"); elsewhere a dot means a site was typed.
    const site = name.includes(".") && (field !== "instagram" || /(^|\.)instagram\.com$/i.test(name));
    if (!site) return `https://${SOCIAL_SITE[field]}/${name}`;
  }
  return value;
}

/**
 * The short text shown for a stored link: "@adaevents" for Instagram and X, the page name for
 * Facebook ("adaevents", or null for profile.php links), and "adaevents.com/about" for a website.
 * Null when the link can't be read; the caller then shows the network's name.
 */
export function socialDisplay(field: SocialField, url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const path = parsed.pathname.replace(/\/+$/, "");
  if (field === "website") {
    const host = parsed.hostname.replace(/^www\./, "");
    const shown = `${host}${path}`;
    return shown.length > 40 ? `${shown.slice(0, 39)}…` : shown;
  }
  const first = decodeURIComponent(path.split("/").filter(Boolean)[0] ?? "");
  if (!first || first === "profile.php") return null;
  return field === "facebook" ? first : `@${first}`;
}

// ── Follow button ───────────────────────────────────────────────────────────────────────────────

export type FollowState = { following: boolean; count: number; pending: boolean; previous: { following: boolean; count: number } | null };
export type FollowAction = { type: "toggle" } | { type: "settled"; following: boolean; count: number } | { type: "failed" };

export const initialFollow = (following: boolean, count: number): FollowState => ({ following, count, pending: false, previous: null });

/**
 * One click changes the button and the count at once (optimistic); the API's answer then sets both,
 * and a failure puts back what was there. Clicks while a change is on its way are ignored.
 */
export function followReducer(state: FollowState, action: FollowAction): FollowState {
  switch (action.type) {
    case "toggle":
      if (state.pending) return state;
      return {
        following: !state.following,
        count: Math.max(0, state.count + (state.following ? -1 : 1)),
        pending: true,
        previous: { following: state.following, count: state.count },
      };
    case "settled":
      return { following: action.following, count: Math.max(0, action.count), pending: false, previous: null };
    case "failed":
      return state.previous ? { ...state.previous, pending: false, previous: null } : { ...state, pending: false };
  }
}

/** A short version for the share card's address: changes when what the card shows changes. */
export function cardVersion(parts: readonly (string | number | boolean | null | undefined)[]): string {
  let h = 5381;
  for (const ch of parts.map((p) => String(p ?? "")).join("|")) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

/** The profile's share card: drawn by the API, passed through by /api/og/h/{handle}. */
export function profileCardPath(handle: string, version: string, lang: string): string {
  return `/api/og/h/${encodeURIComponent(handle)}?v=${encodeURIComponent(version)}&lang=${lang}`;
}
