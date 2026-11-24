"use client";

import { useCallback, useState } from "react";
import { signOut } from "@/app/(site)/auth/actions";

/**
 * Signs out of this device, then loads /sign-in as a full page load. The full load matters: the
 * header's session answer and the router cache are kept across client navigations, so a soft
 * redirect left the page looking signed in. Also drops ticket pages the service worker saved for
 * offline use on this device.
 */
export function useSignOut(): { signOut: () => void; pending: boolean } {
  const [pending, setPending] = useState(false);
  const run = useCallback(() => {
    if (pending) return;
    setPending(true);
    navigator.serviceWorker?.controller?.postMessage("clear-tickets");
    void signOut()
      .catch((e: unknown) => console.error("[auth] sign out", e))
      .finally(() => window.location.replace("/sign-in"));
  }, [pending]);
  return { signOut: run, pending };
}
