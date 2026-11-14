"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// The account corner of every header: "Sign in", or for a signed-in visitor "Admin" (G-ventZ staff
// only), "Dashboard" and an Account menu (two-step sign-in and passkeys, payouts). Pages like the
// home page are cached and shared by every visitor, so this is decided in the browser. The session
// cookie is httpOnly (the browser's JavaScript can't read it), so the answer comes from
// /api/session. The admin pages themselves are still guarded by the API (staff, two-step sign-in).
export default function AccountLink({ className = "hp-signin" }: { className?: string }) {
  const [session, setSession] = useState({ signedIn: false, isStaff: false });
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    let live = true;
    fetch("/api/session", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { signedIn?: boolean; isStaff?: boolean }) => {
        if (live) setSession({ signedIn: d.signedIn === true, isStaff: d.signedIn === true && d.isStaff === true });
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  // Close the menu on navigation, an outside click or Escape.
  useEffect(() => { if (menu.current) menu.current.open = false; }, [pathname]);
  useEffect(() => {
    const close = (e: Event) => {
      const el = menu.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", close); };
  }, []);

  if (!session.signedIn) return <Link href="/sign-in" className={className}>Sign in</Link>;
  return (
    <>
      {session.isStaff && <Link href="/admin" className={`${className} account-admin`}>Admin</Link>}
      <Link href="/dashboard" className={className}>Dashboard</Link>
      <details className="account-menu" ref={menu}>
        <summary className={className} aria-label="Account">Account</summary>
        <div className="account-menu-list">
          {session.isStaff && <Link href="/admin">G-ventZ admin</Link>}
          <Link href="/account/security">Two-step sign-in &amp; passkeys</Link>
          <Link href="/account/payouts">Payouts</Link>
        </div>
      </details>
    </>
  );
}
