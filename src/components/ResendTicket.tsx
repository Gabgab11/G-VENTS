"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { resendTicket } from "@/app/(site)/orders/[orderId]/actions";
import { Button, Field, Input } from "@/design";
import { Dialog, DialogClose, DialogContent, DialogTrigger, useToast } from "@/design/client";

type Props = { orderId: string; ticketId: string; email: string; name: string };

/**
 * "Resend" on a ticket the buyer sent to someone else (D89): a dialog with the address, which the
 * buyer can correct, then the API emails the ticket again and a toast says where it went (masked).
 */
export default function ResendTicket({ orderId, ticketId, email, name }: Props) {
  const t = useTranslations("shared.orderCard.resend");
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState(email);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      setError(null);
      const result = await resendTicket(orderId, ticketId, address);
      if ("error" in result) return setError(result.error);
      setOpen(false);
      toast({ title: t("sent", { email: result.masked }), tone: "success" });
    });

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setAddress(email); setError(null); } }}>
      <DialogTrigger>
        <Button variant="ghost" size="sm" aria-label={t("buttonLabel", { name })}>
          <Send size={16} strokeWidth={1.75} aria-hidden />{t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={t("title", { name })}
        description={t("body")}
        closeLabel={t("close")}
        footer={
          <>
            <DialogClose><Button variant="secondary">{t("cancel")}</Button></DialogClose>
            <Button variant="primary" loading={pending} onClick={send} disabled={!address.trim()}>{t("send")}</Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); send(); }}>
          <Field label={t("email")} error={error ?? undefined}>
            <Input type="email" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={254} autoComplete="off" dir="ltr" required />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
