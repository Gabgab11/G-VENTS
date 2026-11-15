import { describe, expect, it } from "vitest";
import { accountNumber, applicationBody, documentFrom, payoutChangeBody, phoneNumber } from "./application-input";

function form(entries: [string, string | Blob, string?][]): FormData {
  const fd = new FormData();
  for (const [k, v, name] of entries) {
    if (typeof v === "string") fd.append(k, v);
    else fd.append(k, v, name);
  }
  return fd;
}

const good: [string, string][] = [
  ["legal_name", "Ada Obi Events Ltd"],
  ["phone", "+234 801 234 5678"],
  ["payout_country", "ng"],
  ["bank_code", "058"],
  ["bank_name", "Guaranty Trust Bank"],
  ["account_number", "0123 456 789"],
  ["confirm_account", "on"],
];

describe("host application form (HA1)", () => {
  it("maps the form to the API body", () => {
    expect(applicationBody(form(good))).toEqual({
      legalName: "Ada Obi Events Ltd",
      phone: "+2348012345678",
      payoutCountry: "NG",
      bankCode: "058",
      bankName: "Guaranty Trust Bank",
      accountNumber: "0123456789",
    });
  });

  it("refuses what the form must get right", () => {
    const without = (k: string) => form(good.filter(([n]) => n !== k));
    expect(applicationBody(without("legal_name"))).toEqual({ error: "payouts.input.legalName" });
    expect(applicationBody(form([...good.filter(([n]) => n !== "phone"), ["phone", "12"]]))).toEqual({ error: "payouts.input.phone" });
    expect(applicationBody(form([...good.filter(([n]) => n !== "payout_country"), ["payout_country", "US"]]))).toEqual({ error: "payouts.input.country" });
    expect(applicationBody(without("bank_code"))).toEqual({ error: "payouts.input.bank" });
    expect(applicationBody(form([...good.filter(([n]) => n !== "account_number"), ["account_number", "12ab"]]))).toEqual({ error: "payouts.input.accountNumber" });
    expect(applicationBody(without("confirm_account"))).toEqual({ error: "payouts.input.confirmAccount" });
  });

  it("payout change needs only the bank details", () => {
    expect(payoutChangeBody(form([["bank_code", "044"], ["account_number", "9876543210"], ["confirm_account", "on"]]))).toEqual({ bankCode: "044", accountNumber: "9876543210" });
  });

  it("cleans account and phone numbers", () => {
    expect(accountNumber("0123-456-789")).toBe("0123456789");
    expect(accountNumber("123")).toBeNull();
    expect(phoneNumber("(0801) 234-5678")).toBe("08012345678");
    expect(phoneNumber("+1")).toBeNull();
  });
});

describe("document (HA1: JPG, PNG or PDF, at most 10 MB)", () => {
  it("accepts a PDF", () => {
    const doc = documentFrom(form([["document", new Blob(["%PDF-1.4"], { type: "application/pdf" }), "id.pdf"]]));
    expect("error" in doc ? doc.error : doc.contentType).toBe("application/pdf");
  });
  it("refuses missing, wrong type and too large", () => {
    expect(documentFrom(form([]))).toEqual({ error: "payouts.input.documentMissing" });
    expect(documentFrom(form([["document", new Blob(["x"], { type: "image/gif" }), "a.gif"]]))).toEqual({ error: "payouts.input.documentType" });
    expect(documentFrom(form([["document", new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: "image/png" }), "big.png"]]))).toEqual({ error: "payouts.input.documentTooLarge" });
  });
});
