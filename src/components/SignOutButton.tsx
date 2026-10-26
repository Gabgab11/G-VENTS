"use client";

import { signOut } from "@/app/auth/actions";

// Signing out also drops ticket pages the service worker saved for offline use on this device.
export default function SignOutButton() {
  return (
    <form action={signOut} onSubmit={() => navigator.serviceWorker?.controller?.postMessage("clear-tickets")}>
      <button type="submit" className="back-link">Sign out</button>
    </form>
  );
}
