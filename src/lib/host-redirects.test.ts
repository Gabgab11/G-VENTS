import { describe, expect, it } from "vitest";
import { redirectFor } from "./host-redirects";

const ID = "01a1d9b2-5be7-70f5-a17f-4da4c8c3095a";

describe("host redirects", () => {
  it.each([
    ["/dashboard", "/host"],
    [`/dashboard/${ID}`, `/host/events/${ID}`],
    [`/dashboard/${ID}/scan`, `/host/events/${ID}/scan`],
    [`/dashboard/${ID}/guests.csv`, `/host/events/${ID}/guests.csv`],
    ["/events/new", "/host/events/new"],
    ["/account/payouts", "/host/payouts"],
    ["/account/security", "/host/settings/security"],
  ])("%s → %s", (from, to) => expect(redirectFor(from)).toBe(to));

  it("leaves other addresses alone", () => {
    for (const p of ["/host", "/discover", "/events/x", "/dashboardx", `/dashboard/${ID}/other`]) expect(redirectFor(p), p).toBeNull();
  });
});
