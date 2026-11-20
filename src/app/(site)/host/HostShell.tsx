"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/(site)/auth/actions";
import { Banknote, CalendarDays, ExternalLink, Home, LayoutGrid, MoreHorizontal, ScanLine, Settings, Shield, Ticket, Users } from "lucide-react";
import { Avatar } from "@/design";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Sheet, SheetClose, SheetContent, SheetTrigger } from "@/design/client";
import styles from "./HostShell.module.css";

type Labels = Record<
  "skip" | "signOut" | "nav" | "home" | "events" | "orders" | "payouts" | "settings" | "admin" | "scan" | "more" | "viewSite" | "myTickets" | "account" | "close",
  string
>;

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;

/** Is `href` the current section? /host matches only itself; the others match their subtree. */
export function isCurrent(pathname: string, href: string): boolean {
  if (href === "/host") return pathname === "/host";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function HostShell({ name, email, isStaff, labels: l, children }: { name: string; email: string; isStaff: boolean; labels: Labels; children: ReactNode }) {
  const pathname = usePathname();
  const signOutForm = useRef<HTMLFormElement>(null);
  // Signing out also drops ticket pages the service worker saved for offline use on this device.
  const leave = () => { navigator.serviceWorker?.controller?.postMessage("clear-tickets"); signOutForm.current?.requestSubmit(); };
  const side = [
    { href: "/host", label: l.home, icon: <Home {...ICON} /> },
    { href: "/host/events", label: l.events, icon: <CalendarDays {...ICON} /> },
    { href: "/host/orders", label: l.orders, icon: <Users {...ICON} /> },
    { href: "/host/payouts", label: l.payouts, icon: <Banknote {...ICON} /> },
    { href: "/host/settings", label: l.settings, icon: <Settings {...ICON} /> },
    ...(isStaff ? [{ href: "/admin", label: l.admin, icon: <Shield {...ICON} /> }] : []),
  ];
  const tabs = [
    { href: "/host", label: l.home, icon: <Home {...ICON} /> },
    { href: "/host/events", label: l.events, icon: <CalendarDays {...ICON} /> },
    { href: "/host/scan", label: l.scan, icon: <ScanLine {...ICON} /> },
    { href: "/host/payouts", label: l.payouts, icon: <Banknote {...ICON} /> },
  ];
  const aria = (href: string) => (isCurrent(pathname, href) ? ("page" as const) : undefined);

  return (
    <div className={styles.shell}>
      <a href="#host-main" className={styles.skip}>{l.skip}</a>
      <form ref={signOutForm} action={signOut} hidden />

      <aside className={styles.sidebar}>
        <Link href="/host" className={styles.logo}>G-vent<b>Z</b></Link>
        <nav aria-label={l.nav} className={styles.sideNav}>
          {side.map((s) => (
            <Link key={s.href} href={s.href} className={styles.sideLink} aria-current={aria(s.href)}>{s.icon}<span>{s.label}</span></Link>
          ))}
        </nav>
        <div className={styles.sideFoot}>
          <Link href="/discover" className={styles.sideLink}><ExternalLink {...ICON} /><span>{l.viewSite}</span></Link>
          <Menu>
            <MenuTrigger>
              <button type="button" className={styles.account} aria-label={l.account}>
                <Avatar name={name} size={28} />
                <span className={styles.accountText}><span className={styles.accountName}>{name}</span>{email && email !== name && <span className={styles.accountEmail}>{email}</span>}</span>
              </button>
            </MenuTrigger>
            <MenuContent align="start" side="top">
              <MenuItem asChild><Link href="/my-tickets"><Ticket {...ICON} /> {l.myTickets}</Link></MenuItem>
              <MenuItem asChild><Link href="/host/settings"><Settings {...ICON} /> {l.settings}</Link></MenuItem>
              <MenuSeparator />
              <MenuItem onSelect={leave}><LogOut {...ICON} /> {l.signOut}</MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </aside>

      <header className={styles.topbar}>
        <Link href="/host" className={styles.logo}>G-vent<b>Z</b></Link>
        <Link href="/host/settings" aria-label={l.account}><Avatar name={name} size={28} /></Link>
      </header>

      <main id="host-main" className={styles.main} tabIndex={-1}>
        <div className={styles.content}>{children}</div>
      </main>

      <nav aria-label={l.nav} className={styles.tabbar}>
        {tabs.map((s) => (
          <Link key={s.href} href={s.href} className={styles.tab} aria-current={aria(s.href)}>{s.icon}<span>{s.label}</span></Link>
        ))}
        <Sheet>
          <SheetTrigger>
            <button type="button" className={styles.tab} aria-current={["/host/orders", "/host/settings"].some((h) => isCurrent(pathname, h)) ? "page" : undefined}>
              <MoreHorizontal {...ICON} /><span>{l.more}</span>
            </button>
          </SheetTrigger>
          <SheetContent title={l.more} closeLabel={l.close}>
            <nav className={styles.moreNav} aria-label={l.more}>
              {[
                { href: "/host/orders", label: l.orders, icon: <Users {...ICON} /> },
                { href: "/host/settings", label: l.settings, icon: <Settings {...ICON} /> },
                ...(isStaff ? [{ href: "/admin", label: l.admin, icon: <Shield {...ICON} /> }] : []),
                { href: "/my-tickets", label: l.myTickets, icon: <Ticket {...ICON} /> },
                { href: "/discover", label: l.viewSite, icon: <LayoutGrid {...ICON} /> },
              ].map((s) => (
                <SheetClose key={s.href}>
                  <Link href={s.href} className={styles.sideLink} aria-current={aria(s.href)}>{s.icon}<span>{s.label}</span></Link>
                </SheetClose>
              ))}
              <button type="button" className={styles.sideLink} onClick={leave}><LogOut {...ICON} /><span>{l.signOut}</span></button>
            </nav>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
