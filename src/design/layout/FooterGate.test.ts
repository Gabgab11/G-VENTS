import { describe, expect, it } from "vitest";
import { hidesFooter } from "./FooterGate";

describe("hidesFooter", () => {
  it("hides the footer only on the door scanner", () => {
    expect(hidesFooter("/host/events/01a1d9b2-5be7-70f5-a17f-4da4c8c3095a/scan")).toBe(true);
    for (const p of ["/", "/discover", "/e/jazz", "/fr/e/jazz", "/host", "/host/scan", "/my-tickets", "/sign-in", "/admin"]) expect(hidesFooter(p), p).toBe(false);
  });
});
