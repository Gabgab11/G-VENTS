"use client";

import { useTranslations } from "next-intl";
import { useSignOut } from "@/lib/use-sign-out";

// `className` goes on the wrapper (e.g. "sign-out-wide", hidden on phones, where the Account menu has it).
export default function SignOutButton({ className, buttonClassName = "site-account" }: { className?: string; buttonClassName?: string }) {
  const t = useTranslations("common.account");
  const { signOut, pending } = useSignOut();
  return (
    <div className={className}>
      <button type="button" className={buttonClassName} onClick={signOut} disabled={pending}>{t("signOut")}</button>
    </div>
  );
}
