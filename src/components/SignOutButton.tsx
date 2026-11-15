"use client";

import { useTranslations } from "next-intl";
import { signOut } from "@/app/(site)/auth/actions";

// Signing out also drops ticket pages the service worker saved for offline use on this device.
// `className` goes on the form (e.g. "sign-out-wide", hidden on phones, where the Account menu has it).
export default function SignOutButton({ className, buttonClassName = "site-account" }: { className?: string; buttonClassName?: string }) {
  const t = useTranslations("common.account");
  return (
    <form action={signOut} className={className} onSubmit={() => navigator.serviceWorker?.controller?.postMessage("clear-tickets")}>
      <button type="submit" className={buttonClassName}>{t("signOut")}</button>
    </form>
  );
}
