import { describe, expect, it } from "vitest";
import en from "../../messages/en/shared.json";
import { MAPS_URL_HINT, MAPS_URL_HINT_KEY } from "./maps-url";

describe("maps link hint id (Change 3)", () => {
  it("exists and its English is the old hint", () => {
    expect(MAPS_URL_HINT_KEY).toBe("shared.mapsUrl.hint");
    expect(en.mapsUrl.hint).toBe(MAPS_URL_HINT);
  });
});
