import { describe, expect, it } from "vitest";
import { CONTACT_TOPICS, contactCountryOptions, isContactTopic, messageLength, validateContact, type ContactInput } from "./contact";

const good: ContactInput = { name: "Ada Obi", email: "Ada@Example.com ", country: "ng", topic: "refunds", message: "My refund hasn't arrived yet.", website: "" };

describe("contact form (Change 4 follow-up, step 4)", () => {
  it("accepts a complete message and tidies it for the API", () => {
    const r = validateContact({ ...good, name: "  Ada   Obi " });
    expect(r).toEqual({ ok: true, body: { name: "Ada Obi", email: "ada@example.com", country: "NG", topic: "refunds", message: "My refund hasn't arrived yet.", website: "" } });
  });

  it("names each field's problem", () => {
    const r = validateContact({ name: "A", email: "not-an-email", country: "XX", topic: "spam", message: "short", website: "" });
    expect(r).toEqual({ ok: false, errors: { name: "nameLength", email: "emailInvalid", country: "countryMissing", topic: "topicMissing", message: "messageShort" } });
  });

  it("limits the message to 4,000 characters, counting an emoji as one", () => {
    expect(messageLength("🎉🎉")).toBe(2);
    expect(validateContact({ ...good, message: "🎉".repeat(4000) }).ok).toBe(true);
    expect(validateContact({ ...good, message: "a".repeat(4001) })).toEqual({ ok: false, errors: { message: "messageLong" } });
  });

  it("passes the honeypot through untouched (the API drops filled ones quietly)", () => {
    const r = validateContact({ ...good, website: "http://spam.example" });
    expect(r.ok && r.body.website).toBe("http://spam.example");
  });

  it("knows the six topics", () => {
    expect(CONTACT_TOPICS).toEqual(["tickets", "refunds", "hosting", "account", "partnerships", "other"]);
    expect(isContactTopic("hosting")).toBe(true);
    expect(isContactTopic("billing")).toBe(false);
  });

  it("lists countries in the reader's language, sorted by name", () => {
    const fr = contactCountryOptions("fr");
    expect(fr.find((c) => c.value === "DE")?.label).toBe("Allemagne");
    const labels = fr.map((c) => c.label);
    expect(labels).toEqual([...labels].sort(new Intl.Collator("fr").compare));
    expect(contactCountryOptions("en").find((c) => c.value === "NG")?.label).toBe("Nigeria");
  });
});
