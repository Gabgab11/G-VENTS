// Registration links in the Registration tab (Change 6, FR-41/FR-46). The API checks every rule
// again; these only read the host's form into the API's body and say which field is wrong. Pure, so
// server and client both use it (and it's tested). The access-code value is never read back from the
// API (the DTO exposes only `hasCode`), so editing a link always rewrites name, cap and code from the
// form — a blank code field removes the code.
import type { components } from "@/lib/api/schema";

export type RegistrationLink = components["schemas"]["RegistrationLinkDto"];
export type CreateLinkBody = components["schemas"]["CreateRegistrationLinkDto"];
export type UpdateLinkBody = components["schemas"]["UpdateRegistrationLinkDto"];

/** Which field a problem belongs to, and its message id under dashboard.links.errors. */
export type LinkError = { field: "name" | "cap" | "accessCode" | "tierId"; error: string };

/** What the dialog sends. `cap` and `accessCode` empty mean unlimited / no code; `tierId` is create-only. */
export type LinkInput = {
  name: string;
  cap: string;
  accessCode: string;
  tierId: string;
};

const CODE = /^[A-Za-z0-9]{4,32}$/;

/** "" → null (unlimited); a whole number 0–1,000,000 → that number; anything else → undefined. */
export function parseCap(raw: string): number | null | undefined {
  const value = raw.trim();
  if (!value) return null;
  if (!/^\d{1,7}$/.test(value)) return undefined;
  const n = Number(value);
  return n >= 0 && n <= 1_000_000 ? n : undefined;
}

/** "" → null (no code); 4–32 letters/numbers → that code; anything else → undefined. */
export function normalizeAccessCode(raw: string): string | null | undefined {
  const value = raw.trim();
  if (!value) return null;
  return CODE.test(value) ? value : undefined;
}

const isError = (x: unknown): x is LinkError => typeof x === "object" && x !== null && "error" in x;

function readName(raw: string): string | LinkError {
  const name = raw.trim();
  if (name.length < 1 || name.length > 60) return { field: "name", error: "name" };
  return name;
}

/** A new link's body, or the first problem. */
export function createLinkBody(input: LinkInput): { ok: true; body: CreateLinkBody } | ({ ok: false } & LinkError) {
  const name = readName(input.name);
  if (isError(name)) return { ok: false, ...name };
  const cap = parseCap(input.cap);
  if (cap === undefined) return { ok: false, field: "cap", error: "cap" };
  const accessCode = normalizeAccessCode(input.accessCode);
  if (accessCode === undefined) return { ok: false, field: "accessCode", error: "accessCode" };
  const tierId = input.tierId.trim();
  return {
    ok: true,
    body: { name, ...(cap !== null ? { cap } : {}), ...(accessCode !== null ? { accessCode } : {}), ...(tierId ? { tierId } : {}) },
  };
}

/** The changes to an existing link: name, cap (null clears) and code (null removes) are all rewritten. */
export function updateLinkBody(input: LinkInput): { ok: true; body: UpdateLinkBody } | ({ ok: false } & LinkError) {
  const name = readName(input.name);
  if (isError(name)) return { ok: false, ...name };
  const cap = parseCap(input.cap);
  if (cap === undefined) return { ok: false, field: "cap", error: "cap" };
  const accessCode = normalizeAccessCode(input.accessCode);
  if (accessCode === undefined) return { ok: false, field: "accessCode", error: "accessCode" };
  return { ok: true, body: { name, cap, accessCode } };
}

/** The address a link's share URL opens: the event page, and for a segment link its `?r=<token>`. */
export function linkShareUrl(eventUrl: string, token: string, isDefault: boolean): string {
  return isDefault ? eventUrl : `${eventUrl}?r=${encodeURIComponent(token)}`;
}
