"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { ChevronDown, LayoutDashboard, LogOut, ShieldCheck, Ticket, UserRound } from "lucide-react";
import { signOut } from "@/app/(site)/auth/actions";
import { Avatar } from "@/design";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/design/client";
import { firstName, roleOf, useSession, type BrowserSession } from "@/lib/use-session";

// The account corner of the header (FR-34, D92). Pages like the home page are cached and shared by
// every visitor, so who is signed in is decided in the browser: the session cookie is httpOnly, so
// the answer (signed in, name, avatar, staff, host) comes from /api/session, one request per page.
// The admin pages themselves are still guarded by the API (staff, two-step sign-in).

type Classes = { pill?: string; avatar?: string; name?: string; role?: string; chevron?: string; signIn?: string };

/** Signing out also drops ticket pages the service worker saved for offline use on this device. */
function useSignOutForm() {
  const form = useRef<HTMLFormElement>(null);
  const element = (
    <form ref={form} action={signOut} hidden onSubmit={() => navigator.serviceWorker?.controller?.postMessage("clear-tickets")} />
  );
  return { element, submit: () => form.current?.requestSubmit() };
}

function displayName(s: BrowserSession, fallback: string): string {
  return s.name?.trim() || fallback;
}

/** Wide screens: "Sign in", or the account pill (avatar, first name, role line) opening the account menu. */
export default function AccountLink({ classes = {} }: { classes?: Classes }) {
  const t = useTranslations("common.account");
  const session = useSession();
  const signOutForm = useSignOutForm();

  if (!session.signedIn) return <Link href="/sign-in" className={classes.signIn}>{t("signIn")}</Link>;
  const name = displayName(session, t("account"));
  const role = t(`role.${roleOf(session)}`);
  return (
    <>
      {signOutForm.element}
      <Menu>
        <MenuTrigger>
          <button type="button" className={classes.pill} aria-label={t("menu", { name, role })}>
            <Avatar name={name} src={session.avatarUrl} size={28} className={classes.avatar} aria-hidden />
            <span className={classes.name} aria-hidden>
              <span>{firstName(name)}</span>
              <span className={classes.role}>{role}</span>
            </span>
            <ChevronDown size={16} strokeWidth={1.75} aria-hidden className={classes.chevron} />
          </button>
        </MenuTrigger>
        <MenuContent>
          <MenuLabel>{name}</MenuLabel>
          <MenuItem asChild><Link href="/my-tickets"><Ticket aria-hidden />{t("myTickets")}</Link></MenuItem>
          <MenuItem asChild><Link href="/account"><UserRound aria-hidden />{t("account")}</Link></MenuItem>
          {session.isHost ? <MenuItem asChild><Link href="/host"><LayoutDashboard aria-hidden />{t("dashboard")}</Link></MenuItem> : null}
          {session.isStaff ? <MenuItem asChild><Link href="/admin"><ShieldCheck aria-hidden />{t("admin")}</Link></MenuItem> : null}
          <MenuSeparator />
          <MenuItem onSelect={signOutForm.submit}><LogOut aria-hidden />{t("signOut")}</MenuItem>
        </MenuContent>
      </Menu>
    </>
  );
}

/** Phones: the account choices inside the header's menu sheet (My tickets is already in its main links). */
export function AccountSheetSection({ classes = {}, linkClassName, onNavigate }: { classes?: Classes & { head?: string; list?: string }; linkClassName?: string; onNavigate?: () => void }) {
  const t = useTranslations("common.account");
  const session = useSession();
  const signOutForm = useSignOutForm();

  if (!session.signedIn) return <Link href="/sign-in" className={classes.signIn} onClick={onNavigate}>{t("signIn")}</Link>;
  const name = displayName(session, t("account"));
  return (
    <div>
      {signOutForm.element}
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
        <button type="button" className={linkClassName} onClick={signOutForm.submit}>{t("signOut")}</button>
      </nav>
    </div>
  );
}
