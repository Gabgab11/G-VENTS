"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import SignOutButton from "@/components/SignOutButton";

// The account corner of every header: "Sign in", or for a signed-in visitor "Admin" (G-ventZ staff
// only), "Dashboard" and an Account menu (two-step sign-in and passkeys, payouts). Pages like the
// home page are cached and shared by every visitor, so this is decided in the browser. The session
// cookie is httpOnly (the browser's JavaScript can't read it), so the answer comes from
// /api/session. The admin pages themselves are still guarded by the API (staff, two-step sign-in).
export default function AccountLink({ className = "site-account", withSignOut = false }: { className?: string; withSignOut?: boolean }) {
  const t = useTranslations("common.account");
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

  if (!session.signedIn) return <Link href="/sign-in" className={className}>{t("signIn")}</Link>;
  return (
    <>
      {/* On phones these two move into the Account menu (globals.css), so the header fits one line. */}
      {session.isStaff && <Link href="/admin" className={`${className} account-admin`}>{t("admin")}</Link>}
      <Link href="/dashboard" className={`${className} account-dash`}>{t("dashboard")}</Link>
      <details className="account-menu" ref={menu}>
        <summary className={className}>{t("account")}</summary>
        <div className="account-menu-list">
          <Link href="/dashboard" className="account-menu-phone">{t("dashboard")}</Link>
          {session.isStaff && <Link href="/admin">{t("platformAdmin")}</Link>}
          <Link href="/account/security">{t("security")}</Link>
          <Link href="/account/payouts">{t("payouts")}</Link>
          {/* Pages with a Sign out button: on phones it moves in here, so the header fits one line. */}
          {withSignOut && <SignOutButton className="account-menu-phone" buttonClassName="account-menu-item" />}
        </div>
      </details>
    </>
  );
}
