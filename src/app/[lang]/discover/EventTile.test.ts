import { describe, expect, it } from "vitest";
import { cardPrice } from "./EventTile";
import { priceLabel } from "@/lib/price-label";

const t = (key: "price.free" | "price.from", values?: { price: string }) => (key === "price.free" ? "Free" : `From ${values?.price}`);

describe("event tile price", () => {
  it("is Free without a price on sale", () => {
    expect(cardPrice({ min_price_minor: null, currency: null })).toBeNull();
    expect(priceLabel(cardPrice({ min_price_minor: 0, currency: "NGN" }), "en", t)).toBe("Free");
  });

  it("is From the lowest price, formatted from minor units in the event's currency", () => {
    expect(priceLabel(cardPrice({ min_price_minor: 500000, currency: "NGN" }), "en", t)).toBe("From ₦5,000");
  });
});
