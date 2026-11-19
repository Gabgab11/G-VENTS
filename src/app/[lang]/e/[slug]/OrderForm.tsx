"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import type { PageQuestion, PageTicketType } from "@/lib/event-page";
import { placeOrder, type OrderState } from "./actions";
import GuestDetails from "./GuestDetails";
import { Button } from "@/design";

type Props = {
  eventId: string;
  ticketTypes: PageTicketType[];
  questions: PageQuestion[];
  perBuyerLimit: number;
  userEmail: string;
  defaultName: string;
  requireApproval: boolean;
};

// One order for up to the event's per-person limit (U4, US-3.1): a quantity per ticket type,
// optional names for the other guests, the event's questions once.
export default function OrderForm({ eventId, ticketTypes, questions, perBuyerLimit, userEmail, defaultName, requireApproval }: Props) {
  const t = useTranslations("event.order");
  const [state, action, pending] = useActionState<OrderState, FormData>(placeOrder, undefined);
  const first = ticketTypes.find((tt) => tt.remaining === null || tt.remaining > 0);
  const [qty, setQty] = useState<Record<string, number>>(first ? { [first.id]: 1 } : {});
  const total = Object.values(qty).reduce((a, b) => a + b, 0);

  const options = (tt: PageTicketType) => {
    const others = total - (qty[tt.id] ?? 0);
    const max = Math.max(0, Math.min(perBuyerLimit - others, tt.remaining ?? perBuyerLimit));
    return Array.from({ length: max + 1 }, (_, i) => i);
  };

  return (
    <form action={action} className="form register">
      <input type="hidden" name="event_id" value={eventId} />

      <fieldset className="form" style={{ gap: 8, border: 0 }}>
        <legend className="sr-only">{t("legend")}</legend>
        {ticketTypes.map((tt) => {
          const soldOut = tt.remaining !== null && tt.remaining <= 0;
          return (
            <label key={tt.id} className={`tier-pick ${soldOut ? "disabled" : ""}`}>
              <span className="grow">{tt.name}</span>
              <span className="muted small">{soldOut ? t("soldOut") : t("free")}</span>
              {!soldOut && (
                <select className="input qty" name={`qty_${tt.id}`} value={qty[tt.id] ?? 0} aria-label={t("howMany", { name: tt.name })}
                  onChange={(e) => setQty((q) => ({ ...q, [tt.id]: Number(e.target.value) }))}>
                  {options(tt).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
            </label>
          );
        })}
        <p className="muted small">{t("limit", { count: perBuyerLimit })}</p>
      </fieldset>

      <GuestDetails idPrefix="free" total={total} questions={questions} userEmail={userEmail} defaultName={defaultName} />

      {state?.error && <p className="error" role="alert">{state.error}</p>}

      <Button variant="primary" type="submit" disabled={pending || total === 0}>
        {pending ? t("pending") : requireApproval ? t("request", { count: total }) : t("get", { count: total })}
      </Button>
    </form>
  );
}
