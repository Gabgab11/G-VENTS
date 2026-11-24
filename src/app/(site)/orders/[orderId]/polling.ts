// How the order page keeps checking a payment that isn't final (CK8; Change 5 chunk 4). Bank
// transfers and USSD can take minutes, so after the first two minutes it checks less often, and it
// keeps going until 30 minutes after the hold ends (the API still verifies late payments). Pure.

/** Keep checking until this long after the hold ends. */
export const LATE_WINDOW_MS = 30 * 60_000;

/** When to stop checking: 30 minutes after the hold, or after first looking when there's no hold. */
export function watchUntil(holdExpiresAt: number | null, startedAt: number): number {
  return (holdExpiresAt ?? startedAt) + LATE_WINDOW_MS;
}

/** The wait before the next check: 3 s for 2 minutes, then 10 s until 10 minutes, then 30 s. */
export function pollDelay(elapsedMs: number): number {
  if (elapsedMs < 2 * 60_000) return 3_000;
  if (elapsedMs < 10 * 60_000) return 10_000;
  return 30_000;
}
