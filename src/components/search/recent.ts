// Recent searches for the command palette (FR-34), kept in this browser only. Storage can be
// missing or throw (private windows, blocked site data), so every access is guarded and the palette
// works without it.

export const RECENT_KEY = "gventz:recent-searches";
export const RECENT_MAX = 5;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readRecent(store: Storage | null = storage()): string[] {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string" && v.trim() !== "").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** Puts a search first (once, ignoring case) and keeps the newest five; returns the new list. */
export function addRecent(query: string, store: Storage | null = storage()): string[] {
  const q = query.trim();
  if (!q) return readRecent(store);
  const next = [q, ...readRecent(store).filter((r) => r.toLocaleLowerCase() !== q.toLocaleLowerCase())].slice(0, RECENT_MAX);
  try {
    store?.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Full or blocked storage: the list just isn't remembered.
  }
  return next;
}

export function clearRecent(store: Storage | null = storage()): void {
  try {
    store?.removeItem(RECENT_KEY);
  } catch {
    // Nothing to clear.
  }
}
