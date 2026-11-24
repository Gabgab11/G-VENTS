"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, LayoutDashboard, LogOut, ShieldCheck, Ticket, UserRound } from "lucide-react";
import { Avatar } from "@/design";
import { firstName, roleOf, useSession, type BrowserSession } from "@/lib/use-session";
import { useSignOut } from "@/lib/use-sign-out";
import styles from "./AccountLink.module.css";

// The account corner of the header (FR-34, D92). Pages like the home page are cached and shared by
// every visitor, so who is signed in is decided in the browser: the session cookie is httpOnly, so
// the answer (signed in, name, avatar, staff, host) comes from /api/session, one request per page.
// The admin pages themselves are still guarded by the API (staff, two-step sign-in).

type Classes = { pill?: string; avatar?: string; name?: string; role?: string; chevron?: string; signIn?: string };

function displayName(s: BrowserSession, fallback: string): string {
  return s.name?.trim() || fallback;
}

/** Wide screens: "Sign in", or the account pill (avatar, first name, role line) opening the account menu. */
export default function AccountLink({ classes = {} }: { classes?: Classes }) {
  const t = useTranslations("common.account");
  const session = useSession();
  if (!session.signedIn) return <Link href="/sign-in" className={classes.signIn}>{t("signIn")}</Link>;
  return <AccountMenu session={session} classes={classes} />;
}

// A disclosure (button + list of links), not a Radix menu: the header is on every page, and the
// dropdown-menu package would add ~17 KB to each (NFR-18). Escape, an outside click, leaving the
// panel with Tab, or navigating closes it; arrow keys move between the items.
function AccountMenu({ session, classes }: { session: BrowserSession; classes: Classes }) {
  const t = useTranslations("common.account");
  const signOutForm = useSignOut();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const items = () => Array.from(root.current?.querySelectorAll<HTMLElement>(`.${styles.item}`) ?? []);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const list = items();
      if (!list.length) return;
      e.preventDefault();
      if (!open) { setOpen(true); requestAnimationFrame(() => items()[0]?.focus()); return; }
      const at = list.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
      list[at < 0 && e.key === "ArrowUp" ? list.length - 1 : next]?.focus();
    }
  };

  const name = displayName(session, t("account"));
  const role = t(`role.${roleOf(session)}`);
  const close = () => setOpen(false);
  return (
    <div
      ref={root}
      className={styles.root}
      onKeyDown={onKeyDown}
      onBlur={(e) => { if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}
    >
      <button
        ref={button}
        type="button"
        className={classes.pill}
        aria-label={t("menu", { name, role })}
        aria-expanded={open}
        aria-controls={panelId}
        data-state={open ? "open" : "closed"}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={name} src={session.avatarUrl} size={28} className={classes.avatar} aria-hidden />
        <span className={classes.name} aria-hidden>
          <span>{firstName(name)}</span>
          <span className={classes.role}>{role}</span>
        </span>
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden className={classes.chevron} />
      </button>
      <div id={panelId} className={styles.panel} hidden={!open}>
        <p className={styles.label}>{name}</p>
        <Link href="/my-tickets" className={styles.item} onClick={close}><Ticket aria-hidden />{t("myTickets")}</Link>
        <Link href="/account" className={styles.item} onClick={close}><UserRound aria-hidden />{t("account")}</Link>
        {session.isHost ? <Link href="/host" className={styles.item} onClick={close}><LayoutDashboard aria-hidden />{t("dashboard")}</Link> : null}
        {session.isStaff ? <Link href="/admin" className={styles.item} onClick={close}><ShieldCheck aria-hidden />{t("admin")}</Link> : null}
        <hr className={styles.separator} />
        <button type="button" className={styles.item} onClick={signOutForm.signOut} disabled={signOutForm.pending}><LogOut aria-hidden />{t("signOut")}</button>
      </div>
    </div>
  );
}

/** Phones: the account choices inside the header's menu sheet (My tickets is already in its main links). */
export function AccountSheetSection({ classes = {}, linkClassName, onNavigate }: { classes?: Classes & { head?: string; list?: string }; linkClassName?: string; onNavigate?: () => void }) {
  const t = useTranslations("common.account");
  const session = useSession();
  const signOutForm = useSignOut();

  if (!session.signedIn) return <Link href="/sign-in" className={classes.signIn} onClick={onNavigate}>{t("signIn")}</Link>;
  const name = displayName(session, t("account"));
  return (
    <div>
      <div className={classes.head}>
        <Avatar name={name} src={session.avatarUrl} size={36} aria-hidden />
        <span className={classes.name}>
          <span>{name}</span>
          <span className={classes.role}>{t(`role.${roleOf(session)}`)}</span>
        </span>
      </div>
      <nav className={classes.list} aria-label={t("account")}>
        <Link href="/account" className={linkClassName} onClick={onNavigate}>{t("account")}</Link>
        {session.isHost ? <Link href="/host" className={linkClassName} onClick={onNavigate}>{t("dashboard")}</Link> : null}
        {session.isStaff ? <Link href="/admin" className={linkClassName} onClick={onNavigate}>{t("admin")}</Link> : null}
        <button type="button" className={linkClassName} onClick={signOutForm.signOut} disabled={signOutForm.pending}>{t("signOut")}</button>
      </nav>
    </div>
  );
}
