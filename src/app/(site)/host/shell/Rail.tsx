"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { LogOut, Menu as MenuIcon, Pin, PinOff, Ticket, UserRound } from "lucide-react";
import { Avatar } from "@/design";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/design/client";
import { ICON, NavIcon } from "./icons";
import NavGroups, { useCountText } from "./NavGroups";
import { HREF, badgeText, currentKey, railBadge, railItems, readPinned, writePinned, type HostCounts } from "./nav";
import styles from "../HostShell.module.css";

/**
 * The desktop rail (FR-36.1): a column of raised icon tiles with badges, a menu tile that opens the
 * grouped panel, and the account tile. Unpinned, the panel floats over the content and closes on
 * Escape, an outside click or navigation; "Pin open" docks it beside the rail, remembered per user
 * on this browser. The panel follows the menu tile in the page, so Tab goes straight into it.
 */
export default function Rail({ userId, name, isStaff, counts, pathname, onSignOut }: {
  userId: string;
  name: string;
  isStaff: boolean;
  counts: HostCounts;
  pathname: string;
  onSignOut: () => void;
}) {
  const t = useTranslations("host.shell");
  const countText = useCountText();
  const [pinned, setPinned] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const shown = pinned || open;

  useEffect(() => setPinned(readPinned(userId)), [userId]);
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open || pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      menuRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, pinned]);

  const pin = (next: boolean) => {
    setPinned(next);
    setOpen(false);
    writePinned(userId, next);
    if (!next) menuRef.current?.focus();
  };

  const items = railItems(isStaff);
  const current = currentKey(pathname, items);

  return (
    <div className={styles.railCol} data-panel={shown ? (pinned ? "pinned" : "open") : undefined}>
      <button
        ref={menuRef}
        type="button"
        className={styles.tile}
        aria-expanded={shown}
        aria-controls="host-panel"
        onClick={() => (pinned ? pin(false) : setOpen((o) => !o))}
      >
        <MenuIcon {...ICON} />
        <span className={styles.tip}>{t("menu")}</span>
      </button>

      {shown && (
        <div id="host-panel" ref={panelRef} role="region" aria-label={t("menu")} className={styles.panel}>
          <div className={styles.panelBody}>
            <NavGroups pathname={pathname} isStaff={isStaff} counts={counts} onNavigate={pinned ? undefined : () => setOpen(false)} />
          </div>
          <div className={styles.panelFoot}>
            <button type="button" className={styles.pin} onClick={() => pin(!pinned)}>
              {pinned ? <PinOff {...ICON} /> : <Pin {...ICON} />}
              <span>{pinned ? t("unpin") : t("pin")}</span>
            </button>
          </div>
        </div>
      )}

      <nav aria-label={t("nav")} className={styles.tiles}>
        <ul>
          {items.map((k) => {
            const b = railBadge(k, counts);
            return (
              <li key={k}>
                <Link href={HREF[k]} className={styles.tile} aria-current={k === current ? "page" : undefined}>
                  <NavIcon name={k} />
                  <span className={styles.tip}>
                    {t(k)}
                    {b && <span className="sr-only"> ({countText(b)})</span>}
                  </span>
                  {b && (b.kind === "action"
                    ? <span className={styles.dot} aria-hidden />
                    : <span className={styles.badge} data-urgent={b.urgent || undefined} aria-hidden>{badgeText(b.n)}</span>)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Menu>
        <MenuTrigger>
          <button type="button" className={`${styles.tile} ${styles.me}`}>
            <Avatar name={name} size={36} />
            <span className={styles.tip}>{t("account")}</span>
          </button>
        </MenuTrigger>
        <MenuContent align="start" side="top">
          <MenuItem asChild><Link href="/my-tickets"><Ticket {...ICON} /> {t("myTickets")}</Link></MenuItem>
          <MenuItem asChild><Link href="/account"><UserRound {...ICON} /> {t("account")}</Link></MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={onSignOut}><LogOut {...ICON} /> {t("signOut")}</MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}
