import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));

const { csvCell, formatMinor, formatMoneyList, toCsv } = await import("./admin");

describe("admin CSV", () => {
  it("quotes commas, quotes and new lines", () => {
    expect(csvCell('Lagos, "VIP"\nNight')).toBe('"Lagos, ""VIP""\nNight"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });
  it("neutralises spreadsheet formulas (CSV injection)", () => {
    for (const bad of ["=HYPERLINK(\"x\")", "+1+1", "-2", "@SUM(A1)"]) expect(csvCell(bad).replace(/^"/, "")).toMatch(/^'/);
  });
  it("builds rows with CRLF line ends", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});

describe("admin money", () => {
  it("formats minor units in the currency's own decimals", () => {
    expect(formatMinor(250000, "NGN")).toContain("2,500.00");
    expect(formatMinor(4000, "USD")).toContain("40.00");
  });
  it("lists non-zero amounts, or a dash", () => {
    expect(formatMoneyList([])).toBe("—");
    expect(formatMoneyList([{ currency: "NGN", amountMinor: 0 }])).toBe("—");
    expect(formatMoneyList([{ currency: "NGN", amountMinor: 100 }, { currency: "USD", amountMinor: 250 }])).toMatch(/1\.00.*·.*2\.50/);
  });
});
