"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, type ReactNode } from "react";
import type { PageQuestion, PageTicketType } from "@/lib/event-page";
import { placeOrder, type OrderState } from "./actions";
import { maxQuantity } from "./event-cta";
import GuestDetails, { type Buyer, type PhoneSetup } from "./GuestDetails";
import TicketTypeInfo from "./tickets/TicketTypeInfo";
import { groupSizeOf, isSoldOut, summaryLine, ticketTypesInOrder } from "@/lib/group-tickets";
import { useFormValid } from "./use-form-valid";
import { useCheckout } from "./tickets/use-checkout";
import { Button, Card, CardHeader, Select, cx } from "@/design";
import b from "./tickets/Booking.module.css";

type Props = {
  eventId: string;
  ticketTypes: PageTicketType[];
  questions: PageQuestion[];
  perBuyerLimit: number;
  /** Tickets the buyer already holds for this event (counted against the limit). */
  held?: number;
  buyer: Buyer;
  /** The phone's country picker (4b). */
  phone: PhoneSetup;
  requireApproval: boolean;
  /** The event at the top of the summary card (flyer, title, date, venue). */
  summary?: ReactNode;
};

// One order for up to the event's per-person limit (U4, US-3.1), on the booking page: "Registration
// details" on the left (a quantity per ticket type, the buyer's name, the account email, names for the
// other guests, the event's questions), the summary card with "Confirm registration" on the right.
// Both are in the one form, so the button in the summary card submits it. Signed-out buyers confirm
// their email inline first (D88); the button stays disabled until they have.
export default function OrderForm({ eventId, ticketTypes, questions, perBuyerLimit, held = 0, buyer, phone, requireApproval, summary }: Props) {
  const t = useTranslations("event.order");
  const tb = useTranslations("event.booking");
  const tp = useTranslations("event.paid");
  const tk = useTranslations("event.tickets");
  const tv = useTranslations("event.verify");
  const [state, action, pending] = useActionState<OrderState, FormData>(placeOrder, undefined);
  const first = ticketTypes.find((tt) => !isSoldOut(tt));
  const [qty, setQty] = useState<Record<string, number>>(first ? { [first.id]: 1 } : {});
  const total = Object.values(qty).reduce((a, b) => a + b, 0);
  const { ref, valid, check } = useFormValid();
  const checkout = useCheckout({ form: ref, eventId, kind: "free", signedIn: buyer.signedIn, perBuyerLimit, setQty, check });

  return (
    <form action={action} ref={ref} onInput={check} onChange={check} onSubmit={checkout.submitted} className={b.form}>
      <input type="hidden" name="event_id" value={eventId} />

      <Card className={b.details}>
        <CardHeader title={tb("detailsTitle")} />
        <p className={b.lead}>{tb("detailsLead")}</p>

        <fieldset className={b.fieldset}>
          <legend className="sr-only">{t("legend")}</legend>
          {ticketTypes.map((tt) => {
            const soldOut = isSoldOut(tt);
            const size = groupSizeOf(tt);
            return (
              <div key={tt.id} className={cx(b.typeRow, soldOut && b.typeRowOff)}>
                <TicketTypeInfo type={tt} />
                <span className={b.typePrice}>{soldOut ? t("soldOut") : size > 1 ? t("priceAdmits", { price: t("free"), count: size }) : t("free")}</span>
                {!soldOut && (
                  <span className={b.qty}>
                    <Select name={`qty_${tt.id}`} value={qty[tt.id] ?? 0} aria-label={t("howMany", { name: tt.name })}
                      onChange={(e) => setQty((q) => ({ ...q, [tt.id]: Number(e.target.value) }))}>
                      {Array.from({ length: maxQuantity(tt, qty, perBuyerLimit) + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </span>
                )}
              </div>
            );
          })}
          <p className={b.note}>{held > 0 ? t("limitLeft", { count: perBuyerLimit, held }) : t("limit", { count: perBuyerLimit })}</p>
        </fieldset>

        <GuestDetails idPrefix="free" ticketNames={ticketTypesInOrder(qty, ticketTypes).map((tt) => tt.name)} questions={questions} buyer={buyer} phone={phone}
          people={checkout.people} justVerified={checkout.justVerified} onSignedIn={checkout.signedIn} />
      </Card>

      <Card className={b.summary}>
        {summary}
        <div className={b.lines} aria-live="polite">
          {ticketTypes.filter((tt) => (qty[tt.id] ?? 0) > 0).map((tt) => (
            <div className={b.line} key={tt.id}><span>{summaryLine(tb, tt.name, qty[tt.id] ?? 0, groupSizeOf(tt))}</span><span>{tb("free")}</span></div>
          ))}
          <div className={cx(b.line, b.total)}><span>{tp("total")}</span><span>{tb("free")}</span></div>
        </div>

        {state?.error && <p className={b.error} role="alert">{state.error}</p>}

        <Button variant="primary" size="lg" fullWidth type="submit" loading={pending} disabled={!buyer.signedIn || total === 0 || !valid}>
          {pending ? t("pending") : requireApproval ? tb("sendRequest") : tb("confirm")}
        </Button>
        {!buyer.signedIn ? <p className={b.note}>{tv("confirmFirst")}</p> : total > 0 && !valid && !pending && <p className={b.note}>{tb("completeForm")}</p>}
        {requireApproval && <p className={b.note}>{tk("approvalNote")}</p>}
      </Card>
    </form>
  );
}
