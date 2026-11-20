import { describe, expect, it } from "vitest";
import { DRAFT_TTL_MS, draftFromEntries, draftKey, readDraft } from "./booking-draft";

const NOW = 1_800_000_000_000;
const A = "0190a000-0000-7000-8000-00000000000a";

describe("the booking draft across the inline sign-in (D88)", () => {
  const entries: [string, string][] = [
    ["event_id", "e1"],
    ["join_waitlist", "false"],
    ["code", "EARLY10"],
    [`qty_${A}`, "3"],
    ["qty_other", "0"],
    ["buyer_name", "Ada Obi"],
    ["guest_2", "Tolu"],
    ["q_x", "Acme"],
    ["non_refundable", "on"],
  ];

  it("keeps quantities, names, answers and ticks, not the page's own fields", () => {
    expect(draftFromEntries(entries, NOW, "EARLY10")).toEqual({
      qty: { [A]: 3 },
      fields: { buyer_name: "Ada Obi", guest_2: "Tolu", q_x: "Acme", non_refundable: "on" },
      code: "EARLY10",
      savedAt: NOW,
    });
    expect(draftFromEntries(entries, NOW)).not.toHaveProperty("code");
  });

  it("round-trips through storage", () => {
    const draft = draftFromEntries(entries, NOW, "EARLY10");
    expect(readDraft(JSON.stringify(draft), NOW + 5_000)).toEqual(draft);
  });

  it("ignores nothing, junk, stale drafts and bad quantities", () => {
    expect(readDraft(null, NOW)).toBeNull();
    expect(readDraft("{not json", NOW)).toBeNull();
    expect(readDraft("42", NOW)).toBeNull();
    expect(readDraft(JSON.stringify({ qty: {}, fields: {} }), NOW)).toBeNull();
    expect(readDraft(JSON.stringify({ qty: {}, fields: {}, savedAt: NOW - DRAFT_TTL_MS - 1 }), NOW)).toBeNull();
    expect(readDraft(JSON.stringify({ qty: { a: 2, b: 11, c: -1, d: 1.5 }, fields: { n: "x", bad: 3 }, savedAt: NOW }), NOW)).toEqual({
      qty: { a: 2 }, fields: { n: "x" }, savedAt: NOW,
    });
  });

  it("one draft per event and form", () => {
    expect(draftKey("e1", "free")).not.toBe(draftKey("e1", "paid"));
    expect(draftKey("e1", "paid")).not.toBe(draftKey("e2", "paid"));
  });
});
