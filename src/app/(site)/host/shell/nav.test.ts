import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NO_COUNTS, badgeText, currentKey, envBadge, isCurrent, normalizeCounts, panelGroups, pinKey, railBadge, railItems,
  readPinned, rowCount, writePinned, type HostCounts,
} from "./nav";

const counts = (over: Partial<HostCounts> = {}): HostCounts => ({ ...NO_COUNTS, ...over });

describe("normalizeCounts", () => {
  it("keeps whole, positive numbers and a true flag", () => {
    expect(normalizeCounts({ ordersAwaitingApproval: 3, waitlisted: 1, refundsFailed: 0, refundsPending: 2, payoutAction: true, upcomingEvents: 4, drafts: 2.7 }))
      .toEqual({ ordersAwaitingApproval: 3, waitlisted: 1, refundsFailed: 0, refundsPending: 2, payoutAction: true, upcomingEvents: 4, drafts: 2 });
  });
  it("turns anything missing or odd into zero", () => {
    expect(normalizeCounts(null)).toEqual(NO_COUNTS);
    expect(normalizeCounts({ drafts: "5", waitlisted: -1, refundsFailed: Number.NaN, payoutAction: "yes", unreadActivity: 9 })).toEqual(NO_COUNTS);
  });
});

describe("current page", () => {
  it("matches /host only on itself and the others on their subtree", () => {
    expect(isCurrent("/host", "/host")).toBe(true);
    expect(isCurrent("/host/events", "/host")).toBe(false);
    expect(isCurrent("/host/events/abc/guests", "/host/events")).toBe(true);
    expect(isCurrent("/host/eventsx", "/host/events")).toBe(false);
  });
  it("picks the most specific item, so settings pages light the right row", () => {
    const panel = panelGroups(false).flatMap((g) => g.items);
    expect(currentKey("/host/settings/profile", panel)).toBe("profile");
    expect(currentKey("/host/settings/language", panel)).toBe("settings");
    expect(currentKey("/host/settings/profile", railItems(false))).toBe("settings");
    expect(currentKey("/host/events/abc", panel)).toBe("events");
    expect(currentKey("/my-tickets", panel)).toBeNull();
  });
  it("shows Admin to staff only", () => {
    expect(railItems(false)).not.toContain("admin");
    expect(railItems(true)).toContain("admin");
    expect(panelGroups(false).at(-1)?.items).toEqual(["discover"]);
    expect(panelGroups(true).at(-1)?.items).toEqual(["discover", "admin"]);
  });
});

describe("counts on rows and tiles", () => {
  it("says nothing when every count is zero", () => {
    for (const k of panelGroups(true).flatMap((g) => g.items)) expect(rowCount(k, NO_COUNTS)).toBeNull();
  });
  it("shows drafts muted and waiting orders in red", () => {
    expect(rowCount("events", counts({ drafts: 2 }))).toEqual({ kind: "drafts", n: 2, urgent: false });
    expect(rowCount("orders", counts({ ordersAwaitingApproval: 3 }))).toEqual({ kind: "waiting", n: 3, urgent: true });
  });
  it("flags payouts when the account needs action or a refund failed", () => {
    expect(rowCount("payouts", counts({ payoutAction: true }))).toEqual({ kind: "action", urgent: true });
    expect(rowCount("payouts", counts({ refundsFailed: 1 }))).toEqual({ kind: "action", urgent: true });
    expect(rowCount("payouts", counts({ refundsPending: 4 }))).toBeNull();
  });
  it("counts upcoming events on Promote in the panel but not on the rail", () => {
    expect(rowCount("promote", counts({ upcomingEvents: 1 }))).toEqual({ kind: "upcoming", n: 1, urgent: false });
    expect(railBadge("promote", counts({ upcomingEvents: 1 }))).toBeNull();
  });
  it("caps a badge at 99+", () => {
    expect(badgeText(7)).toBe("7");
    expect(badgeText(100)).toBe("99+");
  });
});

describe("Pin open", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("is remembered per user", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } });
    expect(readPinned("u1")).toBe(false);
    writePinned("u1", true);
    expect(store.get(pinKey("u1"))).toBe("1");
    expect(readPinned("u1")).toBe(true);
    expect(readPinned("u2")).toBe(false);
    writePinned("u1", false);
    expect(readPinned("u1")).toBe(false);
  });
  it("falls back to unpinned when storage is blocked", () => {
    vi.stubGlobal("window", { get localStorage(): Storage { throw new Error("blocked"); } });
    expect(readPinned("u1")).toBe(false);
    expect(() => writePinned("u1", true)).not.toThrow();
  });
});

describe("envBadge", () => {
  it("shows Dev locally, Staging on staging and nothing on production", () => {
    expect(envBadge(undefined, "development")).toBe("dev");
    expect(envBadge("staging", "production")).toBe("staging");
    expect(envBadge("production", "production")).toBeNull();
    expect(envBadge(undefined, "production")).toBeNull();
  });
});
