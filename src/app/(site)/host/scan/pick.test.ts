import { describe, expect, it } from "vitest";
import { scannable, scanNow } from "./pick";

const now = new Date("2026-11-20T18:00:00Z");
const ev = (id: string, startsAt: string, extra: Partial<{ status: string; role: string; endsAt: string | null }> = {}) =>
  ({ id, startsAt, endsAt: null, status: "published", role: "owner", ...extra });

describe("scannable", () => {
  it("keeps published events the role can scan, not over, soonest first", () => {
    const list = [
      ev("later", "2026-11-28T18:00:00Z"),
      ev("tonight", "2026-11-20T19:00:00Z"),
      ev("draft", "2026-11-20T19:00:00Z", { status: "draft" }),
      ev("viewer", "2026-11-20T19:00:00Z", { role: "viewer" }),
      ev("over", "2026-11-19T10:00:00Z", { endsAt: "2026-11-19T22:00:00Z" }),
      ev("no-end-running", "2026-11-20T09:00:00Z"),
    ];
    expect(scannable(list, now).map((e) => e.id)).toEqual(["no-end-running", "tonight", "later"]);
  });
  it("lets door staff scan", () => {
    expect(scannable([ev("a", "2026-11-20T19:00:00Z", { role: "checkin" })], now)).toHaveLength(1);
  });
});

describe("scanNow", () => {
  it("opens the only event happening now or within 12 hours", () => {
    expect(scanNow([ev("tonight", "2026-11-20T19:00:00Z"), ev("later", "2026-11-28T18:00:00Z")], now)?.id).toBe("tonight");
  });
  it("asks when there are two, or none soon", () => {
    expect(scanNow([ev("a", "2026-11-20T19:00:00Z"), ev("b", "2026-11-20T20:00:00Z")], now)).toBeNull();
    expect(scanNow([ev("later", "2026-11-28T18:00:00Z")], now)).toBeNull();
  });
});
