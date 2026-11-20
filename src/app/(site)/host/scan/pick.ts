export type ScanCandidate = { id: string; status: string; role: string; startsAt: string; endsAt: string | null };

const SCAN_ROLES = new Set(["owner", "admin", "editor", "checkin"]);
const HOUR = 3_600_000;

/**
 * Events the door can scan for: published, a role that may check guests in, and not over (an event
 * without an end counts as running for 12 hours). Soonest first.
 */
export function scannable<T extends ScanCandidate>(events: T[], now: Date): T[] {
  const t = now.getTime();
  return events
    .filter((e) => e.status === "published" && SCAN_ROLES.has(e.role))
    .filter((e) => (e.endsAt ? new Date(e.endsAt).getTime() : new Date(e.startsAt).getTime() + 12 * HOUR) > t)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

/** The one event to open straight away: the only scannable event that has started or starts within 12 hours. */
export function scanNow<T extends ScanCandidate>(events: T[], now: Date): T | null {
  const soon = scannable(events, now).filter((e) => new Date(e.startsAt).getTime() - now.getTime() < 12 * HOUR);
  return soon.length === 1 ? soon[0] : null;
}
