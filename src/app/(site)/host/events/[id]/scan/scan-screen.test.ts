import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { scanScreen } from "./scan-screen";

const messages = { dashboard: JSON.parse(readFileSync(join(process.cwd(), "messages/en/dashboard.json"), "utf8")) };
const t = createTranslator({ locale: "en", messages, namespace: "dashboard.scan" });
const ticket = { displayName: "Tolu Ade", ticketType: "Regular", number: 2, total: 3, checkedInAt: null, checkedInByName: null };

describe("scanScreen", () => {
  it("green: welcome with name, type and n of m", () => {
    expect(scanScreen({ result: "green", reason: "checked_in", ticket }, t, "en")).toEqual({ tone: "green", title: "Welcome in", detail: "Tolu Ade · Regular · 2 of 3" });
  });

  it("a group ticket says Group of N (D90)", () => {
    expect(scanScreen({ result: "green", reason: "checked_in", ticket: { ...ticket, ticketType: "Table", groupSize: 4, number: 2, total: 5 } }, t, "en").detail)
      .toBe("Tolu Ade · Table · Group of 4 · 2 of 5");
  });

  it("red: already used says when and by whom", () => {
    const s = scanScreen({ result: "red", reason: "already_used", ticket: { ...ticket, checkedInAt: "2026-12-05T18:02:00Z", checkedInByName: "Door 2" } }, t, "en");
    expect(s.tone).toBe("red");
    expect(s.title).toBe("Already checked in");
    expect(s.detail).toMatch(/^Tolu Ade · Regular · 2 of 3 · at \d{2}:\d{2} by Door 2$/);
  });

  it("red: other reasons; nothing about tickets of other events", () => {
    expect(scanScreen({ result: "red", reason: "wrong_event", ticket: null }, t, "en")).toEqual({ tone: "red", title: "Ticket for another event", detail: "" });
    expect(scanScreen({ result: "red", reason: "not_found", ticket: null }, t, "en").title).toBe("Ticket not found");
    expect(scanScreen({ result: "red", reason: "something_new", ticket: null }, t, "en").title).toBe("Not valid");
  });
});
