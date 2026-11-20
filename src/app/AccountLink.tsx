"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import SignOutButton from "@/components/SignOutButton";
import { useSession } from "@/lib/use-session";

// The account corner of every header: "Sign in", or for a signed-in visitor "Admin" (G-ventZ staff
// only), "Dashboard" and an Account menu (two-step sign-in and passkeys, payouts). Pages like the
// home page are cached and shared by every visitor, so this is decided in the browser. The session
// cookie is httpOnly (the browser's JavaScript can't read it), so the answer comes from
// /api/session. The admin pages themselves are still guarded by the API (staff, two-step sign-in).
export default function AccountLink({ className = "site-account" }: { className?: string }) {
  const t = useTranslations("common.account");
  const session = useSession();
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

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
      {/* The Dashboard is for people who host (own or help run an event); "Host an event" is for everyone. */}
      {session.isHost && <Link href="/host" className={`${className} account-dash`}>{t("dashboard")}</Link>}
      <details className="account-menu" ref={menu}>
        <summary className={className}>{t("account")}</summary>
        <div className="account-menu-list">
          <Link href="/my-tickets">{t("myTickets")}</Link>
          {session.isHost && <Link href="/host" className="account-menu-phone">{t("dashboard")}</Link>}
          {session.isStaff && <Link href="/admin">{t("platformAdmin")}</Link>}
          <Link href="/host/settings/security">{t("security")}</Link>
          <Link href="/host/payouts">{t("payouts")}</Link>
          {/* Sign out is always the last item, on every page and screen size. */}
          <SignOutButton className="account-menu-signout" buttonClassName="account-menu-item" />
        </div>
      </details>
    </>
  );
}
