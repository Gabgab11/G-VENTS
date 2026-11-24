"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { LogOut, MoreHorizontal, Ticket } from "lucide-react";
import { useSignOut } from "@/lib/use-sign-out";
import { HeaderTools } from "@/components/SiteHeader";
import { Avatar, Badge } from "@/design";
import { Sheet, SheetContent, SheetTrigger } from "@/design/client";
import { ICON, NavIcon } from "./shell/icons";
import NavGroups from "./shell/NavGroups";
import Rail from "./shell/Rail";
import { HREF, currentKey, panelGroups, type EnvBadge, type NavKey } from "./shell/nav";
import { useHostCounts } from "./shell/useHostCounts";
import styles from "./HostShell.module.css";

const TABS: NavKey[] = ["home", "events", "scan", "payouts"];

/**
 * The host area's shell (HA1; Change 5, FR-36, D95). From 960px: a brand card, the TMI-style rail
 * with its grouped panel, and the page in a large card beside it. Below 960px: a top bar and a bottom
 * tab bar whose More sheet lists the same groups and counts.
 */
export default function HostShell({ userId, name, isStaff, env, children }: {
  userId: string;
  name: string;
  isStaff: boolean;
  env: EnvBadge;
  children: ReactNode;
}) {
  const t = useTranslations("host.shell");
  const pathname = usePathname();
  const counts = useHostCounts();
  const [more, setMore] = useState(false);
  const { signOut: leave } = useSignOut();

  const tab = currentKey(pathname, TABS);
  const inMore = !tab && currentKey(pathname, panelGroups(isStaff).flatMap((g) => g.items)) !== null;
  const payoutsDot = counts.payoutAction || counts.refundsFailed > 0;
  const envBadge = env && <Badge tone={env === "staging" ? "warning" : "info"} plain>{t(`env.${env}`)}</Badge>;
  const logo = <>G-vent<b>Z</b></>;

  return (
    <div className={styles.shell} data-host-shell="">
      <a href="#host-main" className={styles.skip}>{t("skip")}</a>

      <div className={styles.brand}>
        <Link href="/" className={styles.brandLink} aria-label={t("homepage")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the app icon, a small static PNG */}
          <img src="/icons/icon-192.png" alt="" width={44} height={44} className={styles.brandTile} />
          <span className={styles.logo}>{logo}</span>
        </Link>
        {envBadge}
      </div>

      {/* The site header's tools (search ⌘K, language, colour mode, account), top right as on every page. */}
      <div className={styles.tools}><HeaderTools /></div>

      <Rail userId={userId} name={name} isStaff={isStaff} counts={counts} pathname={pathname} onSignOut={leave} />

      <header className={styles.topbar}>
        <span className={styles.topBrand}>
          <Link href="/" className={styles.logo} aria-label={t("homepage")}>{logo}</Link>
          {envBadge}
        </span>
        <Link href="/account" aria-label={t("account")}><Avatar name={name} size={28} /></Link>
      </header>

      <main id="host-main" className={styles.main} tabIndex={-1}>
        <div className={styles.content}>{children}</div>
      </main>

      <nav aria-label={t("nav")} className={styles.tabbar}>
        {TABS.map((k) => (
          <Link key={k} href={HREF[k]} className={styles.tab} aria-current={k === tab ? "page" : undefined}>
            <span className={styles.tabIcon}>
              <NavIcon name={k} />
              {k === "payouts" && payoutsDot && <span className={styles.dot} />}
            </span>
            <span>{t(k)}</span>
            {k === "payouts" && payoutsDot && <span className="sr-only"> ({t("count.action")})</span>}
          </Link>
        ))}
        <Sheet open={more} onOpenChange={setMore}>
          <SheetTrigger>
            <button type="button" className={styles.tab} aria-current={inMore ? "page" : undefined}>
              <span className={styles.tabIcon}>
                <MoreHorizontal {...ICON} />
                {counts.ordersAwaitingApproval > 0 && <span className={styles.dot} />}
              </span>
              <span>{t("more")}</span>
              {counts.ordersAwaitingApproval > 0 && <span className="sr-only"> ({t("count.waiting", { count: counts.ordersAwaitingApproval })})</span>}
            </button>
          </SheetTrigger>
          <SheetContent title={t("more")} closeLabel={t("close")}>
            <nav className={styles.moreNav} aria-label={t("more")}>
              <NavGroups pathname={pathname} isStaff={isStaff} counts={counts} onNavigate={() => setMore(false)} />
              <div className={styles.moreFoot}>
                <Link href="/my-tickets" className={styles.moreLink} onClick={() => setMore(false)}><Ticket {...ICON} /><span>{t("myTickets")}</span></Link>
                <button type="button" className={styles.moreLink} onClick={leave}><LogOut {...ICON} /><span>{t("signOut")}</span></button>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
