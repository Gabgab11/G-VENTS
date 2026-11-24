"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { Banner, Button, Card, CardHeader } from "@/design";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/design/client";
import { signOutEverywhere } from "./actions";
import s from "./account.module.css";

// Sessions (FR-35): "Sign out of all devices" ends every session of the account (Supabase's global
// sign-out), after a confirmation. Like signing out, it also drops the tickets this device saved
// for offline use.

function ConfirmButton({ label, busyLabel }: { label: string; busyLabel: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="danger" loading={pending}>{pending ? busyLabel : label}</Button>;
}

export default function SessionsSection({ failed }: { failed?: boolean }) {
  const t = useTranslations("account.page.sessions");
  return (
    <Card as="section" aria-labelledby="account-sessions" className={s.section}>
      <CardHeader title={<span id="account-sessions">{t("title")}</span>} />
      <p className={s.hint}>{t("hint")}</p>
      {failed && <Banner tone="danger" title={t("failed")} />}
      <Dialog>
        <DialogTrigger>
          <Button variant="secondary" className={s.start}>
            <LogOut size={20} strokeWidth={1.75} aria-hidden />
            {t("button")}
          </Button>
        </DialogTrigger>
        <DialogContent
          title={t("confirmTitle")}
          description={t("confirmText")}
          closeLabel={t("close")}
          footer={
            <form
              action={signOutEverywhere}
              className={s.dialogActions}
              onSubmit={() => navigator.serviceWorker?.controller?.postMessage("clear-tickets")}
            >
              <DialogClose><Button type="button" variant="ghost">{t("cancel")}</Button></DialogClose>
              <ConfirmButton label={t("confirm")} busyLabel={t("signingOut")} />
            </form>
          }
        />
      </Dialog>
    </Card>
  );
}
