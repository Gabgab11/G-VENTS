import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { groupPositions, groupSizeOf, isSoldOut, parseGroupSize, purchasesLeft, summaryLine, ticketCount, ticketTypesInOrder } from "./group-tickets";

const table = { id: "t", name: "Table of 4", groupSize: 4, remaining: 10 as number | null };
const regular = { id: "r", name: "Regular", groupSize: 1, remaining: null as number | null };

describe("group tickets (D90)", () => {
  it("tickets = purchases × group size", () => {
    expect(ticketCount({ t: 1, r: 1 }, [table, regular])).toBe(5);
    expect(ticketCount({ t: 2 }, [table, regular])).toBe(8);
    expect(ticketCount({}, [table, regular])).toBe(0);
  });

  it("each ticket's type in API order: the form's types, each one's tickets together", () => {
    expect(ticketTypesInOrder({ r: 1, t: 1 }, [table, regular]).map((t) => t.name)).toEqual(["Table of 4", "Table of 4", "Table of 4", "Table of 4", "Regular"]);
  });

  it("purchases left and sold out count whole groups", () => {
    expect(purchasesLeft(table)).toBe(2);
    expect(purchasesLeft({ ...table, remaining: 3 })).toBe(0);
    expect(isSoldOut({ ...table, remaining: 3 })).toBe(true);
    expect(isSoldOut(table)).toBe(false);
    expect(purchasesLeft(regular)).toBeNull();
    expect(groupSizeOf({})).toBe(1);
  });

  it("positions within each group", () => {
    const t = (ticketType: string, groupSize: number) => ({ ticketType, groupSize });
    expect(groupPositions([t("Table", 4), t("Table", 4), t("Table", 4), t("Table", 4), t("Table", 4), t("Regular", 1), t("Pair", 2), t("Pair", 2)]))
      .toEqual([1, 2, 3, 4, 1, null, 1, 2]);
  });

  it("host forms' group size: blank or 1 is ordinary, 2-20 a group", () => {
    expect(parseGroupSize(undefined)).toBe(1);
    expect(parseGroupSize("1")).toBe(1);
    expect(parseGroupSize(" 4 ")).toBe(4);
    expect(parseGroupSize("20")).toBe(20);
    expect(parseGroupSize("21")).toBeNull();
    expect(parseGroupSize("0")).toBeNull();
    expect(parseGroupSize("2.5")).toBeNull();
  });

  it("summary lines in English and Arabic", () => {
    const load = (lang: string) => ({ event: JSON.parse(readFileSync(join(process.cwd(), `messages/${lang}/event.json`), "utf8")) });
    const en = createTranslator({ locale: "en", messages: load("en"), namespace: "event.booking" });
    expect(summaryLine(en, "Table of 4", 1, 4)).toBe("Table of 4 × 1 (4 entries)");
    expect(summaryLine(en, "Regular", 2, 1)).toBe("Regular × 2");
    expect(summaryLine(en, "Regular", 2, undefined)).toBe("Regular × 2");
    const ar = createTranslator({ locale: "ar", messages: load("ar"), namespace: "event.booking" });
    expect(summaryLine(ar, "طاولة", 2, 4)).toContain("طاولة × 2");
  });
});
