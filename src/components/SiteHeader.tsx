"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Menu as MenuIcon } from "lucide-react";
import AccountLink from "@/app/AccountLink";
import BackLink from "@/components/BackLink";
import ColorModeToggle from "@/components/ColorModeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Button } from "@/design";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/design/client";
import styles from "./SiteHeader.module.css";

const NAV = [
  { href: "/discover", label: "discover" },
  { href: "/my-tickets", label: "myTickets" },
  { href: "/host/events/new", label: "hostEvent" },
] as const;

// The one header (Change 4, DS4) on every page except the home page (which has its own over the hero):
// a back arrow, the logo (home), the main links (Discover, My tickets, Host an event; Pricing is in
// the footer, D82), language, colour mode and the account corner.
// `back` is where the arrow goes when there's no history to go back to (never back into sign-in);
// `actions` replaces the account link (the dashboard puts Sign out there). On phones the links,
// language and colour mode move into a menu sheet, so the header is always one row.
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
  const links = NAV.map((n) => (
    <Link key={n.href} href={n.href} className={styles.link} aria-current={current === n.href ? "page" : undefined}>{t(`nav.${n.label}`)}</Link>
  ));
  return (
    <header className={styles.header}>
      {back !== false && <BackLink fallback={back} label="←" />}
      <Link href="/" className={styles.logo} aria-label={t("brand.home")}>G-vent<b>Z</b></Link>
      <nav className={styles.nav} aria-label={t("nav.main")}>{links}</nav>
      <div className={styles.actions}>
        <span className={styles.wide}><LanguageSwitcher /></span>
        <span className={styles.wide}><ColorModeToggle /></span>
        {actions ?? <AccountLink className="site-account" />}
        <Sheet>
          <SheetTrigger>
            <Button variant="ghost" icon={<MenuIcon size={20} strokeWidth={1.75} aria-hidden />} aria-label={t("nav.menu")} className={styles.menuButton} />
          </SheetTrigger>
          <SheetContent title={t("nav.menu")} closeLabel={t("nav.closeMenu")}>
            <nav className={styles.sheetNav} aria-label={t("nav.main")}>
              {NAV.map((n) => (
                <SheetClose key={n.href}>
                  <Link href={n.href} className={styles.sheetLink} aria-current={current === n.href ? "page" : undefined}>{t(`nav.${n.label}`)}</Link>
                </SheetClose>
              ))}
            </nav>
            <div className={styles.sheetRow}><LanguageSwitcher className="lang-menu-up" /><ColorModeToggle /></div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
