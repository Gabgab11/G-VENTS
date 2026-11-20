import { describe, expect, it } from "vitest";
import { checkRecipient, draftPeople, readRecipients, recipientRoom } from "./recipients";

const form = (entries: [string, string][]) => {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
};

describe("tickets for other people (D89)", () => {
  it("room: every ticket but the buyer's, at most 20", () => {
    expect(recipientRoom(1)).toBe(0);
    expect(recipientRoom(5)).toBe(4);
    expect(recipientRoom(80)).toBe(20);
    expect(recipientRoom(0)).toBe(0);
  });

  it("checks one row: name required, email optional, valid, not the buyer's", () => {
    expect(checkRecipient("Tolu Ade", "")).toBeNull();
    expect(checkRecipient("Tolu Ade", "Tolu@Example.com", "ada@example.com")).toBeNull();
    expect(checkRecipient("T", "")).toBe("recipientName");
    expect(checkRecipient("Tolu", "not-an-email")).toBe("recipientEmail");
    expect(checkRecipient("Tolu", "ADA@example.com", "ada@example.com")).toBe("recipientIsBuyer");
  });

  it("reads rows for tickets 2, 3, ... only when sending to others", () => {
    const rows: [string, string][] = [["recipient_name_2", " Tolu "], ["recipient_email_2", "Tolu@Example.com"], ["recipient_name_3", "Bisi"], ["recipient_email_3", ""]];
    expect(readRecipients(form(rows))).toEqual({ recipients: [] });
    expect(readRecipients(form([["tickets_for", "others"], ...rows]))).toEqual({ recipients: [{ name: "Tolu", email: "tolu@example.com" }, { name: "Bisi" }] });
    expect(readRecipients(form([["tickets_for", "others"], ["recipient_name_2", ""]]))).toEqual({ error: "recipientName" });
    expect(readRecipients(form([["tickets_for", "others"], ["recipient_name_2", "Tolu"], ["recipient_email_2", "x@y"]]))).toEqual({ error: "recipientEmail" });
  });

  it("at most 20 people", () => {
    const rows = Array.from({ length: 21 }, (_, i): [string, string] => [`recipient_name_${i + 2}`, `Person ${i}`]);
    expect(readRecipients(form([["tickets_for", "others"], ...rows]))).toEqual({ error: "recipientsTooMany" });
    expect("recipients" in readRecipients(form([["tickets_for", "others"], ...rows.slice(0, 20)]))).toBe(true);
  });

  it("a saved draft brings back the choice and the number of rows", () => {
    expect(draftPeople({ tickets_for: "others", recipient_name_2: "A", recipient_email_2: "", recipient_name_3: "B" })).toEqual({ forOthers: true, people: 2 });
    expect(draftPeople({ tickets_for: "me" })).toEqual({ forOthers: false, people: 0 });
  });
});
