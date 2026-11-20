import { describe, expect, it } from "vitest";
import { createBody, discountValue, normalizeCode, parseMaxUses, shareUrl, updateBody, valueText, zonedInput, zonedToIso, type DiscountCode, type DiscountInput } from "./promote-form";
import { activityKind, activityLabelKey, activityValues, appendPage, filterActivity, ACTIVITY_LABELS, type ActivityItem } from "./activity-labels";
import { audienceCount, notSent, remaining, sendBlock, type Allowance } from "./announce";
import { inviteProblem, isInviteToken, landingPath, roleOptions, sortMembers, type TeamMember } from "./team-roles";

const ctx = { currency: "NGN", timeZone: "Africa/Lagos", paidTypeIds: ["vip", "reg"] };
const input = (over: Partial<DiscountInput> = {}): DiscountInput => ({ code: "jazz10", kind: "percent", value: "10", maxUses: "", startsAt: "", endsAt: "", ticketTypeIds: [], ...over });

describe("discount code validation", () => {
  it("upper-cases and checks the code", () => {
    expect(normalizeCode(" early-bird_1 ")).toBe("EARLY-BIRD_1");
    expect(normalizeCode("ab")).toBeNull();
    expect(normalizeCode("a".repeat(33))).toBeNull();
    expect(normalizeCode("NO SPACE")).toBeNull();
    expect(normalizeCode("ÉTÉ10")).toBeNull();
  });

  it("builds a create body and says which field is wrong", () => {
    expect(createBody(input(), ctx)).toEqual({ ok: true, body: { code: "JAZZ10", kind: "percent", value: 1000, maxUses: null, startsAt: null, endsAt: null, ticketTypeIds: [], paused: false } });
    expect(createBody(input({ code: "x" }), ctx)).toMatchObject({ ok: false, field: "code" });
    expect(createBody(input({ value: "0" }), ctx)).toMatchObject({ ok: false, field: "value", error: "percent" });
    expect(createBody(input({ maxUses: "0" }), ctx)).toMatchObject({ ok: false, field: "maxUses" });
    expect(createBody(input({ startsAt: "2026-12-02T10:00", endsAt: "2026-12-01T10:00" }), ctx)).toMatchObject({ ok: false, field: "endsAt", error: "window" });
    expect(createBody(input({ ticketTypeIds: ["other"] }), ctx)).toMatchObject({ ok: false, field: "ticketTypes" });
  });

  it("sends free codes without a value and all chosen types as all", () => {
    const r = createBody(input({ kind: "free", value: "", ticketTypeIds: ["vip", "reg"] }), ctx);
    expect(r).toMatchObject({ ok: true, body: { kind: "free", ticketTypeIds: [] } });
    expect(r.ok && "value" in r.body).toBe(false);
    expect(createBody(input({ ticketTypeIds: ["vip"] }), ctx)).toMatchObject({ ok: true, body: { ticketTypeIds: ["vip"] } });
  });

  it("reads times on the event's wall clock", () => {
    expect(zonedToIso("2026-12-01T18:00", "Africa/Lagos")).toBe("2026-12-01T17:00:00.000Z");
    expect(zonedToIso("", "Africa/Lagos")).toBeNull();
    expect(zonedToIso("tomorrow", "Africa/Lagos")).toBeUndefined();
    expect(zonedInput("2026-12-01T17:00:00.000Z", "Africa/Lagos")).toBe("2026-12-01T18:00");
    expect(zonedInput("2026-12-01T17:00:00.000Z", "Africa/Nairobi")).toBe("2026-12-01T20:00");
    expect(zonedInput(null, "Africa/Lagos")).toBe("");
  });

  it("parses the usage limit", () => {
    expect(parseMaxUses("")).toBeNull();
    expect(parseMaxUses(" 50 ")).toBe(50);
    expect(parseMaxUses("1.5")).toBeUndefined();
    expect(parseMaxUses("-1")).toBeUndefined();
  });

  const used: DiscountCode = { id: "c1", code: "JAZZ10", kind: "percent", value: 1000, maxUses: 50, uses: 3, startsAt: "2026-11-01T09:00:00.000Z", endsAt: null, ticketTypeIds: ["vip"], paused: false, state: "active", locked: true, createdAt: "2026-11-01T09:00:00.000Z" };

  it("lets a used code change only its limit and end", () => {
    const r = updateBody(input({ kind: "fixed", value: "500", maxUses: "60", endsAt: "2026-12-31T23:00", ticketTypeIds: [] }), used, ctx);
    expect(r).toEqual({ ok: true, body: { maxUses: 60, endsAt: "2026-12-31T22:00:00.000Z" } });
    expect(updateBody(input({ maxUses: "2" }), used, ctx)).toMatchObject({ ok: false, field: "maxUses" });
  });

  it("lets an unused code change everything", () => {
    const fresh = { ...used, uses: 0, locked: false };
    expect(updateBody(input({ kind: "fixed", value: "1,500", ticketTypeIds: ["reg"] }), fresh, ctx)).toEqual({
      ok: true, body: { kind: "fixed", value: 150000, maxUses: null, startsAt: null, endsAt: null, ticketTypeIds: ["reg"] },
    });
  });
});

describe("discount value conversion", () => {
  it("turns percent into basis points (1 to 100)", () => {
    expect(discountValue("percent", "12.5", "NGN")).toBe(1250);
    expect(discountValue("percent", "12,5", "NGN")).toBe(1250);
    expect(discountValue("percent", "100", "NGN")).toBe(10000);
    expect(discountValue("percent", "0.5", "NGN")).toBeNull();
    expect(discountValue("percent", "101", "NGN")).toBeNull();
  });

  it("turns whole units of the currency into minor units", () => {
    expect(discountValue("fixed", "500", "NGN")).toBe(50000);
    expect(discountValue("fixed", "500", "JPY")).toBe(500);
    expect(discountValue("fixed", "0", "NGN")).toBeNull();
    expect(discountValue("fixed", "5.50", "NGN")).toBeNull();
    expect(discountValue("free", "anything", "NGN")).toBe(0);
  });

  it("shows stored values back in the form's units", () => {
    expect(valueText({ kind: "percent", value: 1250 }, "NGN")).toBe("12.5");
    expect(valueText({ kind: "fixed", value: 50000 }, "NGN")).toBe("500");
    expect(valueText({ kind: "free", value: 0 }, "NGN")).toBe("");
  });

  it("builds the share link", () => {
    expect(shareUrl("https://g-ventz.com", "/fr/e/jazz", "JAZZ10")).toBe("https://g-ventz.com/fr/e/jazz?code=JAZZ10");
  });
});

const item = (action: string, over: Partial<ActivityItem> = {}): ActivityItem => ({ id: "1", action, subject: null, subjectName: null, meta: {}, at: "2026-11-20T10:00:00Z", actor: { id: "u", name: "Ada" }, ...over });

describe("activity labels", () => {
  it("has a label for every API action and none for unknown ones", () => {
    expect(Object.keys(ACTIVITY_LABELS)).toHaveLength(17);
    expect(activityLabelKey("team.invited")).toBe("teamInvited");
    expect(activityLabelKey("discount.created")).toBeNull();
    expect(activityLabelKey("constructor")).toBeNull();
  });

  it("groups actions by kind and filters", () => {
    expect(activityKind("guest.checked_in")).toBe("guest");
    expect(activityKind("payout.sent")).toBeNull();
    const items = [item("team.invited", { id: "1" }), item("guest.checked_in", { id: "2" }), item("x.y", { id: "3" })];
    expect(filterActivity(items, "team").map((i) => i.id)).toEqual(["1"]);
    expect(filterActivity(items, "all")).toHaveLength(3);
  });

  it("reads the subject, role, date and amount", () => {
    expect(activityValues(item("team.invited", { subject: "ada@example.com", meta: { role: "checkin" } }))).toMatchObject({ subject: "ada@example.com", role: "checkin" });
    expect(activityValues(item("team.role_changed", { subject: "u2", subjectName: "Bo", meta: { from: "viewer", to: "admin" } }))).toMatchObject({ subject: "Bo", role: "admin" });
    expect(activityValues(item("guest.checked_in", { subject: "ticket-id" })).subject).toBeNull();
    expect(activityValues(item("refund.requested", { meta: { amountMinor: 250000, currency: "NGN" } }))).toMatchObject({ amountMinor: 250000, currency: "NGN" });
    expect(activityValues(item("event.rescheduled", { meta: { startsAt: "2026-12-01T17:00:00Z" } })).at).toBe("2026-12-01T17:00:00Z");
  });

  it("appends a page without repeats", () => {
    expect(appendPage([item("a.b", { id: "1" })], [item("a.b", { id: "1" }), item("a.b", { id: "2" })]).map((i) => i.id)).toEqual(["1", "2"]);
  });
});

const allowance = (over: Partial<Allowance> = {}): Allowance => ({
  sendsUsed: 0, sendsAllowed: 2, emailsUsed: 0, emailsAllowed: 1000, periodEndsAt: "2026-12-01T00:00:00Z",
  audience: { all: 40, paid: 10, checked_in: 0, not_checked_in: 40, waitlist: 3 }, ...over,
});

describe("announcement audience and allowance", () => {
  it("counts recipients per audience", () => {
    expect(audienceCount(allowance(), "all")).toBe(40);
    expect(audienceCount(allowance(), "waitlist")).toBe(3);
    expect(remaining(allowance({ sendsUsed: 3, emailsUsed: 10 }))).toEqual({ sends: 0, emails: 990 });
  });

  it("says why Send is off", () => {
    const base = { allowance: allowance(), segment: "all" as const, template: null, started: false, published: true };
    expect(sendBlock(base)).toBeNull();
    expect(sendBlock({ ...base, published: false })).toBe("draft");
    expect(sendBlock({ ...base, started: true })).toBe("started");
    expect(sendBlock({ ...base, started: true, template: "thanks" })).toBeNull();
    expect(sendBlock({ ...base, allowance: allowance({ sendsUsed: 2 }) })).toBe("sends");
    expect(sendBlock({ ...base, allowance: allowance({ emailsUsed: 1000 }) })).toBe("emails");
    expect(sendBlock({ ...base, allowance: allowance({ emailsUsed: 980 }) })).toBe("quota");
    expect(sendBlock({ ...base, segment: "checked_in" })).toBe("empty");
  });

  it("counts emails that didn't go out", () => {
    expect(notSent({ status: "sent", recipientCount: 10, sentCount: 8 })).toBe(2);
    expect(notSent({ status: "sending", recipientCount: 10, sentCount: 8 })).toBe(0);
  });
});

describe("team roles", () => {
  it("offers co-host and door staff first, the rest behind More roles", () => {
    expect(roleOptions(false)).toEqual(["admin", "checkin"]);
    expect(roleOptions(true)).toEqual(["admin", "checkin", "editor", "finance", "viewer"]);
    expect(roleOptions(false, "finance")).toHaveLength(5);
  });

  it("pins the owner and orders members by when they joined", () => {
    const m = (userId: string, role: TeamMember["role"], joinedAt: string | null): TeamMember => ({ userId, role, joinedAt, name: userId, email: null });
    expect(sortMembers([m("b", "admin", "2026-02-01T00:00:00Z"), m("o", "owner", "2026-03-01T00:00:00Z"), m("a", "viewer", "2026-01-01T00:00:00Z")]).map((x) => x.userId)).toEqual(["o", "a", "b"]);
  });

  it("lands door staff on the scanner", () => {
    expect(landingPath({ eventId: "e1", role: "checkin" })).toBe("/host/events/e1/scan");
    expect(landingPath({ eventId: "e1", role: "admin" })).toBe("/host/events/e1");
  });

  it("names invitation problems and checks tokens", () => {
    expect(inviteProblem("team.invite_wrong_account")).toBe("wrong_account");
    expect(inviteProblem("team.invite_gone")).toBe("gone");
    expect(inviteProblem("internal_error")).toBe("failed");
    expect(isInviteToken("a".repeat(43))).toBe(true);
    expect(isInviteToken("a/b")).toBe(false);
  });
});
