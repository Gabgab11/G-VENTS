"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { Menu as MenuIcon } from "lucide-react";
import AccountLink, { AccountSheetSection } from "@/app/AccountLink";
import BackLink from "@/components/BackLink";
import ColorModeToggle from "@/components/ColorModeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import SearchLauncher from "@/components/search/SearchLauncher";
import { Sheet, SheetContent, SheetTrigger } from "@/design/client";
import styles from "./SiteHeader.module.css";

const NAV = [
  { href: "/discover", label: "discover" },
  { href: "/my-tickets", label: "myTickets" },
  { href: "/host/events/new", label: "hostEvent" },
] as const;

// The floating header (Change 5, FR-34, D92) on every public and signed-in page except the host
// area, which has its own rail. A fixed, see-through bar at the top; each group is a rounded pill
// with a blurred surface, so the page scrolls underneath: back arrow, logo, the main links (Pricing
// is in the footer, D82), then search (⌘K), language, colour mode and the account pill.
// A spacer of the bar's height stays in the page where the header is placed, so content starts
// below the bar. On phones it's the logo, a search button and a menu sheet with everything else.
// `back` is where the arrow goes when there's no history to go back to (never back into sign-in);
// `actions` replaces the account pill.
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
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => setSheetOpen(false), [pathname]);

  return (
    <>
      <div className={styles.spacer} aria-hidden />
      <header className={styles.bar}>
        <div className={styles.row}>
          {back !== false && <span className={styles.back}><BackLink fallback={back} label="←" /></span>}
          <Link href="/" className={`${styles.pill} ${styles.logo}`} aria-label={t("brand.home")} dir="ltr">G-vent<b>Z</b></Link>
          <nav className={`${styles.pill} ${styles.nav}`} aria-label={t("nav.main")}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={styles.link} aria-current={current === n.href ? "page" : undefined}>{t(`nav.${n.label}`)}</Link>
            ))}
          </nav>
          <div className={styles.end}>
            <SearchLauncher className={`${styles.pill} ${styles.search}`} labelClassName={styles.searchLabel} kbdClassName={styles.kbd} />
            <span className={`${styles.wide} ${styles.lang}`}><LanguageSwitcher /></span>
            <span className={`${styles.wide} ${styles.mode}`}><ColorModeToggle /></span>
            <span className={styles.wide}>
              {actions ?? (
                <AccountLink
                  classes={{
                    pill: `${styles.pill} ${styles.account}`,
                    avatar: styles.avatar,
                    name: styles.who,
                    role: styles.role,
                    chevron: styles.chevron,
                    signIn: `${styles.pill} ${styles.signIn}`,
                  }}
                />
              )}
            </span>
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger>
                <button type="button" className={`${styles.pill} ${styles.menuButton}`} aria-label={t("nav.menu")}>
                  <MenuIcon size={20} strokeWidth={1.75} aria-hidden />
                </button>
              </SheetTrigger>
              <SheetContent title={t("nav.menu")} closeLabel={t("nav.closeMenu")}>
                <nav className={styles.sheetNav} aria-label={t("nav.main")}>
                  {NAV.map((n) => (
                    <Link key={n.href} href={n.href} className={styles.sheetLink} aria-current={current === n.href ? "page" : undefined} onClick={() => setSheetOpen(false)}>
                      {t(`nav.${n.label}`)}
                    </Link>
                  ))}
                </nav>
                {actions ? null : (
                  <div className={styles.sheetAccount}>
                    <AccountSheetSection
                      classes={{ head: styles.sheetHead, name: styles.sheetWho, role: styles.role, list: styles.sheetNav, signIn: styles.sheetSignIn }}
                      linkClassName={styles.sheetLink}
                      onNavigate={() => setSheetOpen(false)}
                    />
                  </div>
                )}
                <div className={styles.sheetRow}><LanguageSwitcher className="lang-menu-up" /><ColorModeToggle /></div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </>
  );
}
