"use client";

import { useEffect, useState } from "react";

export type BrowserSession = { signedIn: boolean; isStaff: boolean; isHost: boolean; language?: string };

const SIGNED_OUT: BrowserSession = { signedIn: false, isStaff: false, isHost: false };
let pending: Promise<BrowserSession> | null = null;

/** One /api/session request per page load, shared by every component that asks. */
export function loadSession(): Promise<BrowserSession> {
  pending ??= fetch("/api/session", { cache: "no-store", credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : {}))
    .then((d: Partial<BrowserSession>) => ({
      ...d,
      signedIn: d.signedIn === true,
      isStaff: d.signedIn === true && d.isStaff === true,
      isHost: d.signedIn === true && d.isHost === true,
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
    return () => { live = false; };
  }, []);
  return session;
}
