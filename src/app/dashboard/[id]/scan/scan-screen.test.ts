import { describe, expect, it } from "vitest";
import { scanScreen } from "./scan-screen";

const ticket = { displayName: "Tolu Ade", ticketType: "Regular", number: 2, total: 3, checkedInAt: null, checkedInByName: null };

describe("scanScreen", () => {
  it("green: welcome with name, type and n of m", () => {
    expect(scanScreen({ result: "green", reason: "checked_in", ticket })).toEqual({ tone: "green", title: "Welcome in", detail: "Tolu Ade · Regular · 2 of 3" });
  });

  it("red: already used says when and by whom", () => {
    const s = scanScreen({ result: "red", reason: "already_used", ticket: { ...ticket, checkedInAt: "2026-12-05T18:02:00Z", checkedInByName: "Door 2" } });
    expect(s.tone).toBe("red");
    expect(s.title).toBe("Already checked in");
    expect(s.detail).toMatch(/^Tolu Ade · Regular · 2 of 3 · at \d{2}:\d{2} by Door 2$/);
  });

  it("red: other reasons; nothing about tickets of other events", () => {
    expect(scanScreen({ result: "red", reason: "wrong_event", ticket: null })).toEqual({ tone: "red", title: "Ticket for another event", detail: "" });
    expect(scanScreen({ result: "red", reason: "not_found", ticket: null }).title).toBe("Ticket not found");
    expect(scanScreen({ result: "red", reason: "something_new", ticket: null }).title).toBe("Not valid");
  });
});
