import { describe, expect, it } from "vitest";
import { normalizePhone, ticketWhatsAppMessage, whatsappLink } from "./whatsapp";

describe("normalizePhone", () => {
  it("accepts spaced and punctuated international numbers", () => {
    expect(normalizePhone("+234 801 234 5678")).toBe("+2348012345678");
    expect(normalizePhone("+44 (7700) 900-123")).toBe("+447700900123");
  });

  it("turns 00 prefixes into +", () => {
    expect(normalizePhone("0020 1001 234 567")).toBe("+201001234567");
  });

  it("rejects numbers without a country code or with letters", () => {
    expect(normalizePhone("08012345678")).toBeNull();
    expect(normalizePhone("+234 abc")).toBeNull();
    expect(normalizePhone("+0123456789")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("whatsappLink", () => {
  it("builds a wa.me link with digits only and an encoded message", () => {
    expect(whatsappLink("+234 801 234 5678", "Hi there & thanks")).toBe(
      "https://wa.me/2348012345678?text=Hi%20there%20%26%20thanks",
    );
  });

  it("returns null when the business number is missing", () => {
    expect(whatsappLink("", "hi")).toBeNull();
  });
});

describe("ticketWhatsAppMessage", () => {
  it("includes the event, code and link", () => {
    const text = ticketWhatsAppMessage("Lagos Jazz Night", "9F3C 2A71", "https://www.gventz.com/t/abc");
    expect(text).toContain("Lagos Jazz Night");
    expect(text).toContain("9F3C 2A71");
    expect(text).toContain("https://www.gventz.com/t/abc");
  });
});
