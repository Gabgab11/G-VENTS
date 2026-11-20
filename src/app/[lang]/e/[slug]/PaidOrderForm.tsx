"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormat } from "@/i18n/format-hooks";
import type { PageQuestion, PageTicketType } from "@/lib/event-page";
import { NON_REFUNDABLE_KEY, ORGANIZER_KEY, type FeeChoice } from "@/lib/payment-text";
import { placePaidOrder, quotePaid, type OrderState, type Quote } from "./actions";
import { maxQuantity } from "./event-cta";
import GuestDetails from "./GuestDetails";
import { useFormValid } from "./use-form-valid";
import { Button, Card, CardHeader, Checkbox, Select, cx } from "@/design";
import b from "./tickets/Booking.module.css";

type Props = {
  eventId: string;
  ticketTypes: PageTicketType[];
  questions: PageQuestion[];
  perBuyerLimit: number;
  /** Tickets the buyer already holds for this event (counted against the limit). */
  held?: number;
  userEmail: string;
  defaultName: string;
  refundPolicy: string | null;
  feeChoice: FeeChoice;
  /** The event at the top of the summary card (flyer, title, date, venue). */
  summary?: ReactNode;
};

// Paid tickets (M5, CK1–CK4) on the booking page: paid ticket types only (free ones are a separate
// order). "Registration details" on the left; on the right the summary card with a live breakdown from
// the API's quote, the event's refund policy, the organizer statement and the non-refundable tick box,
// then "Pay with Paystack". Both are in the one form. A sold-out type can be chosen to join its
// waiting list (WL1).
export default function PaidOrderForm({ eventId, ticketTypes, questions, perBuyerLimit, held = 0, userEmail, defaultName, refundPolicy, feeChoice, summary }: Props) {
  const t = useTranslations("event.paid");
  const tb = useTranslations("event.booking");
  const root = useTranslations();
  const format = useFormat();
  const formatMinor = format.money;
  const [state, action, pending] = useActionState<OrderState, FormData>(placePaidOrder, undefined);
  const first = ticketTypes.find((tt) => tt.remaining === null || tt.remaining > 0);
  const [qty, setQty] = useState<Record<string, number>>(first ? { [first.id]: 1 } : {});
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const { ref, valid, check } = useFormValid();
  const total = Object.values(qty).reduce((a, b) => a + b, 0);
  const soldOut = (tt: PageTicketType) => tt.remaining !== null && tt.remaining <= 0;
  const waitlist = ticketTypes.some((tt) => soldOut(tt) && (qty[tt.id] ?? 0) > 0);
  // A string key, so the quote is asked for again only when the chosen tickets change.
  const linesKey = useMemo(() => JSON.stringify(Object.entries(qty).filter(([, n]) => n > 0).map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }))), [qty]);
  const currency = ticketTypes[0]?.currency ?? "NGN";

  useEffect(() => {
    setQuoteError("");
    const lines = JSON.parse(linesKey) as { ticketTypeId: string; quantity: number }[];
    if (lines.length === 0) { setQuote(null); return; }
    let live = true;
    const timer = setTimeout(() => {
      quotePaid(eventId, lines).then((res) => {
        if (!live) return;
        if ("error" in res) { setQuote(null); setQuoteError(res.error); }
        else setQuote(res);
      });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [eventId, linesKey]);

  // Shown before the quote arrives, and if it can't be had: the plain sum of the prices.
  const subtotal = ticketTypes.reduce((sum, tt) => sum + tt.priceMinor * (qty[tt.id] ?? 0), 0);

  return (
    <form action={action} ref={ref} onInput={check} onChange={check} className={b.form}>
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="join_waitlist" value={waitlist ? "true" : "false"} />

      <Card className={b.details}>
        <CardHeader title={tb("detailsTitle")} />
        <p className={b.lead}>{tb("detailsLead")}</p>

        <fieldset className={b.fieldset}>
          <legend className="sr-only">{t("legend")}</legend>
          {ticketTypes.map((tt) => (
            <div key={tt.id} className={b.typeRow}>
              <span className={b.typeName}>{tt.name}</span>
              <span className={b.typePrice}>{soldOut(tt) ? t("soldOutWaitlist") : formatMinor(tt.priceMinor, tt.currency)}</span>
              <span className={b.qty}>
                <Select name={`qty_${tt.id}`} value={qty[tt.id] ?? 0} aria-label={root("event.order.howMany", { name: tt.name })}
                  onChange={(e) => setQty((q) => ({ ...q, [tt.id]: Number(e.target.value) }))}>
                  {Array.from({ length: maxQuantity(tt, qty, perBuyerLimit, true) + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              </span>
            </div>
          ))}
          <p className={b.note}>{held > 0 ? root("event.order.limitLeft", { count: perBuyerLimit, held }) : root("event.order.limit", { count: perBuyerLimit })}</p>
        </fieldset>

        <GuestDetails idPrefix="paid" total={total} questions={questions} userEmail={userEmail} defaultName={defaultName} />
      </Card>

      <Card className={b.summary}>
        {summary}

        {total > 0 && !waitlist && (
          <div className={b.lines} aria-live="polite">
            {quote ? (
              <>
                {quote.lines.map((l) => (
                  <div className={b.line} key={l.ticketTypeId}>
                    <span>{tb("line", { name: l.name, count: l.quantity })}</span><span>{formatMinor(l.unitPriceMinor * l.quantity, quote.currency)}</span>
                  </div>
                ))}
                {quote.serviceFeeMinor > 0 && (
                  <div className={b.line}>
                    <span>{t("serviceFee")}{quote.vatMinor > 0 ? <span className={b.muted}>{` ${t("includesVat", { amount: formatMinor(quote.vatMinor, quote.currency) })}`}</span> : null}</span>
                    <span>{formatMinor(quote.serviceFeeMinor, quote.currency)}</span>
                  </div>
                )}
                {!!quote.discountMinor && quote.discountMinor > 0 && (
                  <div className={b.line}>
                    <span>{tb("discount", { code: quote.discountCode ?? "" })}</span><span>{`−${formatMinor(quote.discountMinor, quote.currency)}`}</span>
                  </div>
                )}
                <div className={cx(b.line, b.total)}><span>{t("total")}</span><span>{formatMinor(quote.totalMinor, quote.currency)}</span></div>
                {quote.serviceFeeMinor === 0 && <p className={b.note}>{t("feesIncluded")}</p>}
              </>
            ) : (
              <>
                <div className={b.line}><span>{t("subtotal")}</span><span>{formatMinor(subtotal, currency)}</span></div>
                <p className={b.note}>{quoteError || (feeChoice === "guest_pays" ? t("workingFee") : t("workingTotal"))}</p>
              </>
            )}
          </div>
        )}
        {waitlist && <p className={b.note}>{t("waitlistNote")}</p>}

        <div className={b.terms}>
          {refundPolicy && <p><b>{t("refundPolicy")}</b> {refundPolicy}</p>}
          <p className={b.muted}>{root(ORGANIZER_KEY)}</p>
          <Checkbox name="non_refundable" required label={root(NON_REFUNDABLE_KEY)} className={b.check} />
        </div>

        {state?.error && <p className={b.error} role="alert">{state.error}</p>}

        <Button variant="primary" size="lg" fullWidth type="submit" loading={pending} disabled={total === 0 || !valid}>
          {pending ? (waitlist ? t("joining") : t("opening")) : waitlist ? t("join") : quote ? t("payTotal", { total: formatMinor(quote.totalMinor, quote.currency) }) : t("pay")}
        </Button>
        {total > 0 && !valid && !pending && <p className={b.note}>{tb("completeForm")}</p>}
        {!waitlist && <p className={b.note}>{t("payNote")}</p>}
      </Card>
    </form>
  );
}
