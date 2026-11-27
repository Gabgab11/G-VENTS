"use client";

import { useEffect, useState } from "react";

export type BrowserSession = {
  signedIn: boolean;
  isStaff: boolean;
  isHost: boolean;
  language?: string;
  /** The account's name (or the part of the email before "@" when no name is set), for the header's account pill. */
  name?: string;
  avatarUrl?: string | null;
};

/** The line under the name in the account pill: staff, then hosts, then everyone else. */
export function roleOf(s: Pick<BrowserSession, "isStaff" | "isHost">): "staff" | "host" | "guest" {
  return s.isStaff ? "staff" : s.isHost ? "host" : "guest";
}

/** The first word of a name ("Ada Lovelace" → "Ada"); the whole string when it is one word. */
export function firstName(name: string | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? "";
}

const SIGNED_OUT: BrowserSession = { signedIn: false, isStaff: false, isHost: false };
let pending: Promise<BrowserSession> | null = null;
const listeners = new Set<(s: BrowserSession) => void>();

/** Ask again (e.g. right after an inline sign-in) and update every component using useSession. */
export function refreshSession(): Promise<BrowserSession> {
  pending = null;
  return loadSession().then((s) => { listeners.forEach((l) => l(s)); return s; });
}

/** One /api/session request per page load, shared by every component that asks. */
export function loadSession(): Promise<BrowserSession> {
  pending ??= fetch("/api/session", { cache: "no-store", credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : {}))
    .then((d: Partial<BrowserSession>) => ({
      ...d,
      signedIn: d.signedIn === true,
      isStaff: d.signedIn === true && d.isStaff === true,
      isHost: d.signedIn === true && d.isHost === true,
      name: d.signedIn === true && typeof d.name === "string" ? d.name : undefined,
      avatarUrl: d.signedIn === true && typeof d.avatarUrl === "string" ? d.avatarUrl : null,
    }))
    .catch(() => SIGNED_OUT);
  return pending;
}

/**
 * Who this browser is, for pages that are cached and shared by every visitor (they can't decide on
 * the server). Signed out until the answer arrives. Client navigations reuse the answer; signing in
 * or out reloads the page, which starts afresh.
 */
export function useSession(): BrowserSession {
  const [session, setSession] = useState<BrowserSession>(SIGNED_OUT);
  useEffect(() => {
    let live = true;
    void loadSession().then((s) => { if (live) setSession(s); });
    listeners.add(setSession);
    return () => { live = false; listeners.delete(setSession); };
  }, []);
  return session;
}
