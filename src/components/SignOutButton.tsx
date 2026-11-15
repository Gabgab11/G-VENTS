"use client";

import { useTranslations } from "next-intl";
import { signOut } from "@/app/(site)/auth/actions";

// Signing out also drops ticket pages the service worker saved for offline use on this device.
export default function SignOutButton() {
  const t = useTranslations("common.account");
  return (
    <form action={signOut} onSubmit={() => navigator.serviceWorker?.controller?.postMessage("clear-tickets")}>
      <button type="submit" className="site-account">{t("signOut")}</button>
    </form>
  );
}
