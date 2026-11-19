// The "floor" of the back button after signing in (user request 2026-11-19: once signed in, the
// back arrow never goes back to the sign-in page or Google's; the farthest it goes is home).
// Sign-in marks that it is leaving; the first page after it records its position in this tab's
// history; BackLink never goes back past that position. Per tab (sessionStorage), best effort.

const LEAVING = "gventz_auth_leaving";
const FLOOR = "gventz_auth_floor";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Called by the sign-in screen just before it sends the browser on (email code or Google). */
export function markLeavingSignIn(): void {
  storage()?.setItem(LEAVING, "1");
}

/** Called once on every page load: the first page after sign-in becomes the floor. */
export function recordAuthFloor(historyLength: number): void {
  const s = storage();
  if (!s || s.getItem(LEAVING) !== "1") return;
  s.removeItem(LEAVING);
  s.setItem(FLOOR, String(historyLength - 1));
}

/** Whether going back would reach the floor's page or anything before it (sign-in, Google). */
export function backWouldLeaveSession(historyLength: number, floor: number | null): boolean {
  if (historyLength <= 1) return true;
  return floor !== null && historyLength - 1 <= floor;
}

export function readAuthFloor(): number | null {
  const v = storage()?.getItem(FLOOR);
  const n = v === null || v === undefined ? NaN : Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
}
