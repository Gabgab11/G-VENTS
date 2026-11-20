"use client";

import { useEffect, useReducer, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { Banner, Button, Checkbox } from "@/design";
import { Dialog, DialogClose, DialogContent, DialogTrigger, useToast } from "@/design/client";
import { refundTicket } from "./actions";
import { opensOnLoad, refundReducer, twoStepHref, type RefundView } from "./refund-dialog";
import styles from "./workspace.module.css";

type Props = {
  eventId: string;
  ticketId: string;
  name: string;
  /** What the guest gets back, already formatted ("₦213,825.00"). */
  amount: string;
  ticketType: string;
  /** "two_step" when this session hasn't used two-step sign-in yet. */
  start: RefundView;
  /** The ?refund= ticket id on the page, to reopen this dialog after two-step sign-in. */
  requested?: string;
};

/**
 * One paid ticket's refund (M5 RefundAction, RF4/RF5) in a dialog: the amount the guest gets back,
 * what happens, a confirmation and the button. Asks for two-step sign-in first when needed.
 */
export default function RefundDialog({ eventId, ticketId, name, amount, ticketType, start, requested }: Props) {
  const t = useTranslations("dashboard.guests.refund");
  const tools = useTranslations("dashboard.tools");
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, dispatch] = useReducer(refundReducer, { view: start, confirmed: false, error: null, reason: null });
  const formId = `refund-${ticketId}`;

  // Back from two-step sign-in: open this ticket's dialog again, then drop ?refund= from the address.
  useEffect(() => {
    if (!opensOnLoad(requested, ticketId)) return;
    setOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("refund");
    window.history.replaceState(null, "", url);
  }, [requested, ticketId]);

  const change = (next: boolean) => {
    setOpen(next);
    if (next) dispatch({ type: "reset", view: start });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await refundTicket(eventId, ticketId, state.confirmed);
      dispatch({ type: "result", result });
      if (result.ok) {
        setOpen(false);
        toast({ title: t("started", { name }), description: t("startedText"), tone: "success" });
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger>
        <Button size="sm" variant="secondary" aria-label={t("openLabel", { name })}>{t("summary")}</Button>
      </DialogTrigger>
      {state.view === "two_step" ? (
        <DialogContent
          title={t("twoStepTitle")}
          closeLabel={tools("close")}
          footer={
            <>
              <DialogClose><Button variant="secondary">{tools("cancel")}</Button></DialogClose>
              <Button variant="primary" href={twoStepHref(eventId, ticketId)}>
                <ShieldCheck size={20} strokeWidth={1.75} aria-hidden />{t("twoStepButton")}
              </Button>
            </>
          }
        >
          <p className={styles.muted}>{t("twoStepText", { name })}</p>
        </DialogContent>
      ) : (
        <DialogContent
          title={t("title", { name })}
          closeLabel={tools("close")}
          footer={
            <>
              <DialogClose><Button variant="secondary" disabled={pending}>{tools("cancel")}</Button></DialogClose>
              <Button variant="danger" type="submit" form={formId} loading={pending} disabled={!state.confirmed}>{t("button")}</Button>
            </>
          }
        >
          <form id={formId} className={styles.refundForm} onSubmit={submit}>
            <dl className={styles.refundFacts}>
              <div><dt>{t("guestLabel")}</dt><dd><bdi>{name}</bdi></dd></div>
              <div><dt>{t("ticketLabel")}</dt><dd><bdi>{ticketType}</bdi></dd></div>
              <div><dt>{t("amountLabel")}</dt><dd className={styles.refundAmount}><bdi>{amount}</bdi></dd></div>
            </dl>
            <ul className={styles.refundSteps}>
              <li>{t("whatTicket")}</li>
              <li>{t("whatMoney", { amount })}</li>
              <li>{t("whatFees")}</li>
            </ul>
            {state.error && (
              <Banner tone="danger" title={state.error}>
                {state.reason ? t("providerReason", { reason: state.reason }) : null}
              </Banner>
            )}
            <Checkbox
              name="confirm"
              checked={state.confirmed}
              onChange={(e) => dispatch({ type: "confirm", checked: e.target.checked })}
              label={t("confirm", { amount, name })}
            />
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
