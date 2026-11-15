"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import AccountLink from "@/app/AccountLink";
import BackLink from "@/components/BackLink";
import ColorModeToggle from "@/components/ColorModeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const NAV = [
  { href: "/discover", label: "discover" },
  { href: "/pricing", label: "pricing" },
  { href: "/events/new", label: "createEvent" },
] as const;

// The header on every page except the home page (which has its own): a back arrow, the logo (home),
// the main links, the colour switch and Sign in / Dashboard. `back` is where the arrow goes when
// there's no history to go back to; `actions` replaces the account link (the dashboard puts
// Sign out there).
export default function SiteHeader({
  back = "/",
  current,
  actions,
}: {
  back?: string | false;
  current?: (typeof NAV)[number]["href"];
  actions?: ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <header className="site-top">
      {back !== false && <BackLink fallback={back} label="←" />}
      <Link href="/" className="site-logo" aria-label={t("brand.home")}>G-vent<b>Z</b></Link>
      <nav className="site-nav" aria-label={t("nav.main")}>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={current === n.href ? "page" : undefined}>{t(`nav.${n.label}`)}</Link>
        ))}
      </nav>
      <div className="site-actions">
        <LanguageSwitcher />
        <ColorModeToggle />
        {actions ?? <AccountLink className="site-account" />}
      </div>
    </header>
  );
}
