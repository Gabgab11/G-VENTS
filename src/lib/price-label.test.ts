import { describe, expect, it } from "vitest";
import { lowestPrice, priceLabel } from "./price-label";

const t = (key: "price.free" | "price.from", v?: { price: string }) => (key === "price.free" ? "Free" : `From ${v?.price}`);

describe("price-label", () => {
  it("is free when nothing costs money", () => {
    expect(lowestPrice([{ priceMinor: 0, currency: "NGN" }])).toBeNull();
    expect(priceLabel(null, "en", t)).toBe("Free");
  });
  it("takes the lowest paid price still available", () => {
    expect(lowestPrice([
      { priceMinor: 0, currency: "NGN" },
      { priceMinor: 1_000_000, currency: "NGN" },
      { priceMinor: 500_000, currency: "NGN", remaining: 0 },
      { priceMinor: 750_000, currency: "NGN", remaining: 3 },
    ])).toEqual({ minor: 750_000, currency: "NGN" });
  });
  it("keeps the decimals of an amount that isn't whole", () => {
    expect(priceLabel({ minor: 500_050, currency: "NGN" }, "en", t)).toBe("From ₦5,000.50");
  });
  it("formats from minor units in the page's language", () => {
    expect(priceLabel({ minor: 500_000, currency: "NGN" }, "en", t)).toBe("From ₦5,000");
  });
});
