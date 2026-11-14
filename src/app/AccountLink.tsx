"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// "Sign in" or "Dashboard". Pages like the home page are cached and shared by every visitor, so
// this is decided in the browser. The session cookie is httpOnly (the browser's JavaScript can't
// read it), so the answer comes from /api/session.
export default function AccountLink({ className = "hp-signin" }: { className?: string }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/session", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { signedIn: false }))
      .then((d: { signedIn?: boolean }) => { if (live) setSignedIn(d.signedIn === true); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  return signedIn
    ? <Link href="/dashboard" className={className}>Dashboard</Link>
    : <Link href="/sign-in" className={className}>Sign in</Link>;
}
