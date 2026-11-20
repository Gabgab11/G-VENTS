import type { StatTrend } from "@/design";

export const PERIODS = ["7d", "30d", "90d", "12m"] as const;
export type Period = (typeof PERIODS)[number];

/** Message key for a period (ids can't start with a digit). */
export const PERIOD_KEY: Record<Period, string> = { "7d": "week", "30d": "month", "90d": "quarter", "12m": "year" };

/** The period from `?period=`, 30 days when missing or unknown. */
export function periodOf(raw: string | undefined): Period {
  return (PERIODS as readonly string[]).includes(raw ?? "") ? (raw as Period) : "30d";
}

/** A Stat delta from the API's change (percent, one decimal; null when the previous figure was 0). */
export function deltaOf(change: number | null, current: number): { trend: StatTrend; percent: string } | null {
  if (change === null) return current > 0 ? null : { trend: "flat", percent: "0" };
  const trend: StatTrend = change > 0 ? "up" : change < 0 ? "down" : "flat";
  return { trend, percent: String(Math.abs(change)) };
}

/** How many of the checklist's steps are done. */
export function stepsDone(c: Record<string, boolean>): number {
  return Object.values(c).filter(Boolean).length;
}
