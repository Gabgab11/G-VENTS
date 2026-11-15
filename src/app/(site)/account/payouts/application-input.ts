import type { components } from "@/lib/api/schema";
import { field } from "@/lib/forms";
import { isPayoutCountry } from "@/lib/payment-text";

// The host application and payout-change forms → the API's bodies (M5, business rules HA1/HA4).
// Checks only what the form must get right; the API checks the bank account with Paystack.
// Errors are message ids in the `account` area (e.g. "payouts.input.bank"); the actions translate them.

export type ApplicationBody = Omit<components["schemas"]["HostApplicationInputDto"], "documentPath">;
export type PayoutChangeBody = components["schemas"]["PayoutAccountChangeDto"];

export const DOCUMENT_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const DOCUMENT_MAX = 10 * 1024 * 1024;

const BANK_CODE = /^[A-Za-z0-9-]{1,30}$/;

/** Digits only, 6 to 20 of them (NUBAN is 10; other countries vary). Spaces and dashes are dropped. */
export function accountNumber(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "");
  return /^\d{6,20}$/.test(digits) ? digits : null;
}

/** "+234 801 234 5678" → "+2348012345678"; null unless 7 to 15 digits with an optional leading +. */
export function phoneNumber(raw: string): string | null {
  const compact = raw.replace(/[\s().-]/g, "");
  return /^\+?\d{7,15}$/.test(compact) ? compact : null;
}

function bankFrom(formData: FormData): { bankCode: string; bankName?: string; accountNumber: string } | { error: string } {
  const bankCode = field(formData, "bank_code", 30);
  if (!BANK_CODE.test(bankCode)) return { error: "payouts.input.bank" };
  const number = accountNumber(field(formData, "account_number", 40));
  if (!number) return { error: "payouts.input.accountNumber" };
  const bankName = field(formData, "bank_name", 120);
  return { bankCode, ...(bankName ? { bankName } : {}), accountNumber: number };
}

export function applicationBody(formData: FormData): ApplicationBody | { error: string } {
  const legalName = field(formData, "legal_name", 200);
  if (legalName.length < 2) return { error: "payouts.input.legalName" };
  const phone = phoneNumber(field(formData, "phone", 40));
  if (!phone) return { error: "payouts.input.phone" };
  const payoutCountry = field(formData, "payout_country", 2).toUpperCase();
  if (!isPayoutCountry(payoutCountry)) return { error: "payouts.input.country" };
  const bank = bankFrom(formData);
  if ("error" in bank) return bank;
  if (formData.get("confirm_account") !== "on") return { error: "payouts.input.confirmAccount" };
  return { legalName, phone, payoutCountry, ...bank };
}

export function payoutChangeBody(formData: FormData): PayoutChangeBody | { error: string } {
  const bank = bankFrom(formData);
  if ("error" in bank) return bank;
  if (formData.get("confirm_account") !== "on") return { error: "payouts.input.confirmAccount" };
  return bank;
}

/** A file from a form, recognised by shape (see src/lib/flyer.ts for why not `instanceof File`). */
function isUpload(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && typeof (value as Blob).arrayBuffer === "function" && typeof (value as Blob).size === "number";
}

/** The ID or business document (HA1: JPG, PNG or PDF, at most 10 MB), or why it can't be used. */
export function documentFrom(formData: FormData): { file: File; contentType: DocumentType } | { error: string } {
  const file = formData.get("document");
  if (!isUpload(file) || file.size === 0) return { error: "payouts.input.documentMissing" };
  if (file.size > DOCUMENT_MAX) return { error: "payouts.input.documentTooLarge" };
  const contentType = (DOCUMENT_TYPES as readonly string[]).includes(file.type) ? (file.type as DocumentType) : null;
  if (!contentType) return { error: "payouts.input.documentType" };
  return { file, contentType };
}
