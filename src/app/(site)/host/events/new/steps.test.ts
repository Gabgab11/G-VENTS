import { describe, expect, it } from "vitest";
import {
  LAST_STEP, STEPS, canVisit, checkStep, fieldOfMessageKey, fieldOfProblem, fieldsOfStep, firstFailingStep, nextStep, previousStep, stepOfField,
} from "./steps";

/** A FormData-like reader over [name, value] pairs (repeated names allowed, like the tier fields). */
function form(entries: [string, string][]) {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

const valid: [string, string][] = [
  ["title", "Jazz Night"], ["category", "Music"],
  ["date", "2026-12-05"], ["time", "18:00"], ["end_date", "2026-12-05"], ["end_time", "23:00"], ["country_code", "NG"], ["venue", "Eko Hotel"],
  ["tier_name", "Regular"], ["tier_qty", ""], ["tier_price", "0"],
];
const without = (name: string) => valid.filter(([k]) => k !== name);
const replace = (name: string, value: string) => [...without(name), [name, value] as [string, string]];

describe("create-event stepper: steps", () => {
  it("has four steps in order", () => {
    expect(STEPS).toEqual(["basics", "when", "tickets", "publish"]);
    expect(LAST_STEP).toBe(3);
  });

  it("puts every submitted field on its step", () => {
    expect(fieldsOfStep(0)).toEqual(["title", "category", "description"]);
    for (const f of ["date", "time", "end_date", "end_time", "time_zone", "is_online", "country_code", "region", "venue", "maps_url"]) expect(stepOfField(f), f).toBe(1);
    for (const f of ["tier_name", "tier_qty", "tier_price", "fee_choice", "per_buyer_limit"]) expect(stepOfField(f), f).toBe(2);
    for (const f of ["flyer", "cover_theme", "visibility", "show_attendee_count", "require_approval", "refund_policy", "intent"]) expect(stepOfField(f), f).toBe(3);
  });

  it("sends unknown or missing fields to the last step", () => {
    expect(stepOfField(undefined)).toBe(LAST_STEP);
    expect(stepOfField("nonsense")).toBe(LAST_STEP);
    expect(stepOfField("toString")).toBe(LAST_STEP);
  });

  it("moves next and back within bounds", () => {
    expect(nextStep(0)).toBe(1);
    expect(nextStep(LAST_STEP)).toBe(LAST_STEP);
    expect(previousStep(2)).toBe(1);
    expect(previousStep(0)).toBe(0);
  });

  it("lets the indicator go back to finished steps only", () => {
    expect(canVisit(0, 2)).toBe(true);
    expect(canVisit(1, 2)).toBe(true);
    expect(canVisit(2, 2)).toBe(false);
    expect(canVisit(3, 2)).toBe(false);
    expect(canVisit(-1, 2)).toBe(false);
  });
});

describe("create-event stepper: checks before Continue", () => {
  it("passes a complete form", () => {
    for (let s = 0; s <= LAST_STEP; s++) expect(checkStep(s, form(valid)), `step ${s}`).toBeNull();
    expect(firstFailingStep(form(valid))).toBeNull();
  });

  it("basics: the event name needs 3 characters", () => {
    expect(checkStep(0, form(replace("title", " Hi ")))).toEqual({ field: "title", key: "createEvent.validation.title" });
  });

  it("when & where: start, end after start, a country unless online, a Google Maps link", () => {
    expect(checkStep(1, form(without("time")))).toMatchObject({ field: "date", key: "createEvent.validation.start" });
    expect(checkStep(1, form(without("end_date")))).toMatchObject({ field: "end_date", key: "createEvent.validation.end" });
    expect(checkStep(1, form(replace("end_time", "17:00")))).toMatchObject({ field: "end_date", key: "createEvent.validation.endAfterStart" });
    expect(checkStep(1, form(without("country_code")))).toMatchObject({ field: "country_code", key: "createEvent.validation.country" });
    expect(checkStep(1, form(without("venue")))).toMatchObject({ field: "venue", key: "createEvent.validation.venue" });
    expect(checkStep(1, form([...without("country_code").filter(([k]) => k !== "venue"), ["is_online", "on"]]))).toBeNull();
    expect(checkStep(1, form([...valid, ["maps_url", "https://evil.example/x"]]))).toMatchObject({ field: "maps_url" });
    expect(checkStep(1, form([...valid, ["maps_url", "https://maps.app.goo.gl/abc123"]]))).toBeNull();
  });

  it("tickets: at least one named ticket, quantities whole and above 0", () => {
    expect(checkStep(2, form(replace("tier_name", "  ")))).toMatchObject({ field: "tier_name", key: "createEvent.validation.noTickets" });
    expect(checkStep(2, form(replace("tier_qty", "0")))).toEqual({ field: "tier_qty", key: "createEvent.validation.quantity", values: { name: "Regular" } });
    expect(checkStep(2, form(replace("tier_qty", "2.5")))).toMatchObject({ field: "tier_qty" });
    expect(checkStep(2, form(replace("tier_qty", "150")))).toBeNull();
  });

  it("a submit goes to the first step that fails", () => {
    const broken = form([...replace("title", "x").filter(([k]) => k !== "tier_name"), ["tier_name", ""]]);
    expect(firstFailingStep(broken)).toMatchObject({ step: 0, problem: { field: "title" } });
    expect(firstFailingStep(form(without("end_time")))).toMatchObject({ step: 1 });
  });
});

describe("create-event stepper: server errors → step", () => {
  it("maps the form's own validation messages to their field", () => {
    expect(stepOfField(fieldOfMessageKey("createEvent.validation.title"))).toBe(0);
    expect(stepOfField(fieldOfMessageKey("createEvent.validation.endAfterStart"))).toBe(1);
    expect(stepOfField(fieldOfMessageKey("shared.mapsUrl.hint"))).toBe(1);
    expect(stepOfField(fieldOfMessageKey("createEvent.validation.price"))).toBe(2);
    expect(stepOfField(fieldOfMessageKey("createEvent.validation.perBuyer"))).toBe(2);
    expect(fieldOfMessageKey("createEvent.save.failed")).toBeUndefined();
  });

  it("maps API problems by field path first, then by code", () => {
    expect(fieldOfProblem({ code: "validation_failed", errors: [{ field: "location.countryCode" }] })).toBe("country_code");
    expect(fieldOfProblem({ code: "validation_failed", errors: [{ field: "ticketTypes.0.priceMinor" }] })).toBe("tier_price");
    expect(fieldOfProblem({ code: "validation_failed", errors: [{ field: "ticketTypes.1.quantity" }] })).toBe("tier_qty");
    expect(fieldOfProblem({ code: "validation_failed", errors: [{ field: "endsAt" }] })).toBe("end_date");
    expect(fieldOfProblem({ code: "event.location_invalid", errors: [{ field: "venueName" }] })).toBe("venue");
    expect(fieldOfProblem({ code: "event.title_length" })).toBe("title");
    expect(fieldOfProblem({ code: "event.paid_not_allowed" })).toBe("tier_price");
    expect(fieldOfProblem({ code: "event.refund_policy_length" })).toBe("refund_policy");
    expect(stepOfField(fieldOfProblem({ code: "internal_error" }))).toBe(LAST_STEP);
    expect(fieldOfProblem(undefined)).toBeUndefined();
  });
});
