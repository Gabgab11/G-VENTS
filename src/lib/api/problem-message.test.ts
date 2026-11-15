import { describe, expect, it } from "vitest";
import { ApiError, GENERIC_MESSAGE, problemMessage, type ErrorTranslator } from "./problem";
import errors from "../../../messages/en/errors.json";

const catalogue: Record<string, string> = { "order.sold_out": "Ce type de billet est épuisé.", "event.region_invalid": "Choisissez une région dans la liste." };
const t = Object.assign((k: string) => catalogue[k]!, { has: (k: string) => k in catalogue }) as ErrorTranslator;
const err = (status: number, code: string, detail: string, fieldErrors?: { field: string; code: string; message: string }[]) =>
  new ApiError({ status, code, detail, ...(fieldErrors ? { errors: fieldErrors } : {}) });

describe("problemMessage (W6, FR-26, D70)", () => {
  it("English shows the API's own text, as today", () => {
    expect(problemMessage(err(409, "order.sold_out", "VIP is sold out."), t, "en")).toBe("VIP is sold out.");
  });

  it("other languages show the translation of the code, or of the field error's code", () => {
    expect(problemMessage(err(409, "order.sold_out", "VIP is sold out."), t, "fr")).toBe("Ce type de billet est épuisé.");
    expect(problemMessage(err(400, "validation.failed", "Check the form.", [{ field: "location.region", code: "event.region_invalid", message: "Choose a state from the list." }]), t, "fr")).toBe("Choisissez une région dans la liste.");
  });

  it("falls back to the API's English text for codes not translated yet, and never shows 5xx details", () => {
    expect(problemMessage(err(404, "brand.new_code", "Something new."), t, "fr")).toBe("Something new.");
    expect(problemMessage(err(500, "internal_error", "stack trace"), t, "fr")).toBe(GENERIC_MESSAGE);
    expect(problemMessage(new Error("network"), t, "fr", "Try again.")).toBe("Try again.");
  });

  it("the English catalogue has a message for every API error code it was seeded with", () => {
    const flat = Object.entries(errors as Record<string, Record<string, string>>).flatMap(([ns, v]) => Object.keys(v).map((k) => `${ns}.${k}`));
    expect(flat.length).toBeGreaterThanOrEqual(130);
    for (const code of ["order.sold_out", "event.not_found", "auth.required", "rate_limit.exceeded"]) expect(flat).toContain(code);
  });
});
