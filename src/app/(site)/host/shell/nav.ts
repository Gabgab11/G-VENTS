// The host sidebar's model (Change 5, FR-36, D95): which pages sit in the rail and in the grouped
// panel, which one is current, and what each count says. Pure, so the shell and the tests share it.

/** GET /v1/host/counts, through the website route /api/host/counts. */
export type HostCounts = {
  ordersAwaitingApproval: number;
  waitlisted: number;
  refundsFailed: number;
  refundsPending: number;
  payoutAction: boolean;
  upcomingEvents: number;
  drafts: number;
};

export const NO_COUNTS: HostCounts = {
  ordersAwaitingApproval: 0, waitlisted: 0, refundsFailed: 0, refundsPending: 0, payoutAction: false, upcomingEvents: 0, drafts: 0,
};

const whole = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Whatever the API sent, as counts: anything missing or odd is zero, so the shell never breaks. */
export function normalizeCounts(raw: unknown): HostCounts {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    ordersAwaitingApproval: whole(r.ordersAwaitingApproval),
    waitlisted: whole(r.waitlisted),
    refundsFailed: whole(r.refundsFailed),
    refundsPending: whole(r.refundsPending),
    payoutAction: r.payoutAction === true,
    upcomingEvents: whole(r.upcomingEvents),
    drafts: whole(r.drafts),
  };
}

export type NavKey =
  | "home" | "events" | "orders" | "scan" | "payouts" | "promote" | "profile"
  | "settings" | "security" | "appearance" | "discover" | "admin";

export const HREF: Record<NavKey, string> = {
  home: "/host",
  events: "/host/events",
  orders: "/host/orders",
  scan: "/host/scan",
  payouts: "/host/payouts",
  promote: "/host/events?filter=upcoming",
  profile: "/host/settings/profile",
  settings: "/host/settings",
  security: "/host/settings/security",
  appearance: "/host/settings/appearance",
  discover: "/discover",
  admin: "/admin",
};

export type GroupKey = "work" | "money" | "grow" | "account" | "elsewhere";

export function panelGroups(isStaff: boolean): { key: GroupKey; items: NavKey[] }[] {
  return [
    { key: "work", items: ["home", "events", "orders", "scan"] },
    { key: "money", items: ["payouts"] },
    { key: "grow", items: ["promote", "profile"] },
    { key: "account", items: ["settings", "security", "appearance"] },
    { key: "elsewhere", items: isStaff ? ["discover", "admin"] : ["discover"] },
  ];
}

export function railItems(isStaff: boolean): NavKey[] {
  return ["home", "events", "orders", "payouts", "scan", "settings", ...(isStaff ? (["admin"] as const) : [])];
}

/** Is `href` the current section? /host matches only itself; the others match their subtree. */
export function isCurrent(pathname: string, href: string): boolean {
  if (href === "/host") return pathname === "/host";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The one item among `keys` that is the current page: the longest matching address, so
 * /host/settings/profile is Profile in the panel and Settings in the rail. Promote shares the events
 * list's address and is never current.
 */
export function currentKey(pathname: string, keys: readonly NavKey[]): NavKey | null {
  let best: NavKey | null = null;
  for (const k of keys) {
    if (k === "promote" || !isCurrent(pathname, HREF[k])) continue;
    if (!best || HREF[k].length > HREF[best].length) best = k;
  }
  return best;
}

/** What sits at the end of a panel row: a count to show, and whether it is urgent (red). */
export type RowCount = { kind: "drafts" | "waiting" | "upcoming"; n: number; urgent: boolean } | { kind: "action"; urgent: true };

export function rowCount(key: NavKey, c: HostCounts): RowCount | null {
  if (key === "events" && c.drafts > 0) return { kind: "drafts", n: c.drafts, urgent: false };
  if (key === "orders" && c.ordersAwaitingApproval > 0) return { kind: "waiting", n: c.ordersAwaitingApproval, urgent: true };
  if (key === "payouts" && (c.payoutAction || c.refundsFailed > 0)) return { kind: "action", urgent: true };
  if (key === "promote" && c.upcomingEvents > 0) return { kind: "upcoming", n: c.upcomingEvents, urgent: false };
  return null;
}

/** A rail tile's badge: a number (urgent ones red), a red dot, or nothing. */
export function railBadge(key: NavKey, c: HostCounts): RowCount | null {
  return key === "promote" ? null : rowCount(key, c);
}

/** The short number on a badge: 99+ past 99. */
export const badgeText = (n: number) => (n > 99 ? "99+" : String(n));

/** localStorage key for "Pin open", one per user on this browser. */
export const pinKey = (userId: string) => `gventz.host.panelPinned.${userId}`;

export function readPinned(userId: string): boolean {
  try {
    return window.localStorage.getItem(pinKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function writePinned(userId: string, pinned: boolean): void {
  try {
    if (pinned) window.localStorage.setItem(pinKey(userId), "1");
    else window.localStorage.removeItem(pinKey(userId));
  } catch {
    // Storage blocked (private window): the choice lasts until the page is left.
  }
}

/** The environment badge in the brand card: Dev or Staging, nothing on production. */
export type EnvBadge = "dev" | "staging" | null;

export function envBadge(appEnv: string | undefined, nodeEnv: string | undefined): EnvBadge {
  if (appEnv === "production") return null;
  if (appEnv === "staging") return "staging";
  if (appEnv) return "dev";
  return nodeEnv === "development" ? "dev" : null;
}
