"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, type ReactNode } from "react";
import { useFormat } from "@/i18n/format-hooks";
import type { PageQuestion, PageTicketType } from "@/lib/event-page";
import { NON_REFUNDABLE_KEY, ORGANIZER_KEY, PROVIDER_METHODS, providerName, type FeeChoice, type ProviderId } from "@/lib/payment-text";
import { placePaidOrder, type OrderState } from "./actions";
import { maxQuantity } from "./event-cta";
import GuestDetails, { type Buyer, type PhoneSetup } from "./GuestDetails";
import TicketTypeInfo from "./tickets/TicketTypeInfo";
import { groupSizeOf, isSoldOut, summaryLine, ticketTypesInOrder } from "@/lib/group-tickets";
import { useFormValid } from "./use-form-valid";
import { useCheckout } from "./tickets/use-checkout";
import { useQuote } from "./tickets/use-quote";
import DiscountCode, { isolate } from "./tickets/DiscountCode";
import { Badge, Banner, Button, Card, CardHeader, Checkbox, Select, cx } from "@/design";
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
  /** A discount code from a `?code=` link, applied straight away (D91). */
  initialCode?: string | null;
  refundPolicy: string | null;
  feeChoice: FeeChoice;
  /** The provider a checkout would use now (PS4); the quote's provider wins once there is one. */
  provider?: ProviderId | null;
  /** PS6: no provider for the event's country, or the host has no active subaccount with it. */
  paused?: boolean;
  /** The event at the top of the summary card (flyer, title, date, venue). */
  summary?: ReactNode;
};

// Paid tickets (M5, CK1–CK4) on the booking page: paid ticket types only (free ones are a separate
// order). "Registration details" on the left; on the right the summary card with a live breakdown from
// the API's quote, the event's refund policy, the organizer statement and the non-refundable tick box,
// then "Pay with {provider}" (Paystack or Flutterwave, from the quote; Change 5 chunk 4) with the ways
// to pay on its page. Both are in the one form. When paid sales are paused (PS6) the types show
// "Paid tickets are paused" and can't be chosen. A sold-out type can be chosen to join its
// waiting list (WL1). The summary card has the discount code box (D91); signed-out buyers confirm
// their email inline first (D88), and the button stays disabled until they have.
export default function PaidOrderForm({ eventId, ticketTypes, questions, perBuyerLimit, held = 0, buyer, phone, initialCode = null, refundPolicy, feeChoice, provider = null, paused = false, summary }: Props) {
  const t = useTranslations("event.paid");
  const tb = useTranslations("event.booking");
  const tv = useTranslations("event.verify");
  const root = useTranslations();
  const format = useFormat();
  const formatMinor = format.money;
  const [state, action, pending] = useActionState<OrderState, FormData>(placePaidOrder, undefined);
  const first = paused ? undefined : ticketTypes.find((tt) => !isSoldOut(tt));
  const [qty, setQty] = useState<Record<string, number>>(first ? { [first.id]: 1 } : {});
  const { ref, valid, check } = useFormValid();
  const total = Object.values(qty).reduce((a, b) => a + b, 0);
  const soldOut = (tt: PageTicketType) => isSoldOut(tt);
  const waitlist = ticketTypes.some((tt) => soldOut(tt) && (qty[tt.id] ?? 0) > 0);
  const currency = ticketTypes[0]?.currency ?? "NGN";
  const { quote, quoteError, ...discount } = useQuote(eventId, qty, initialCode);
  const payOn = quote?.provider ?? provider ?? "paystack";
  const providerLabel = providerName(payOn);
  const checkout = useCheckout({ form: ref, eventId, kind: "paid", signedIn: buyer.signedIn, perBuyerLimit, setQty, check, code: discount.code, restoreCode: discount.restore });

  // Shown before the quote arrives, and if it can't be had: the plain sum of the prices.
  const subtotal = ticketTypes.reduce((sum, tt) => sum + tt.priceMinor * (qty[tt.id] ?? 0), 0);

  return (
    <form action={action} ref={ref} onInput={check} onChange={check} onSubmit={checkout.submitted} className={b.form}>
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="join_waitlist" value={waitlist ? "true" : "false"} />
      <input type="hidden" name="code" value={waitlist ? "" : discount.code} />

      <Card className={b.details}>
        <CardHeader title={tb("detailsTitle")} />
        <p className={b.lead}>{tb("detailsLead")}</p>

        {paused && <Banner tone="warning" title={t("paused")}>{t("pausedNote")}</Banner>}
        <fieldset className={b.fieldset} disabled={paused}>
          <legend className="sr-only">{t("legend")}</legend>
          {ticketTypes.map((tt) => (
            <div key={tt.id} className={cx(b.typeRow, paused && b.typeRowOff)}>
              <TicketTypeInfo type={tt} />
              <span className={b.typePrice}>
                {paused ? t("paused") : soldOut(tt) ? t("soldOutWaitlist") : groupSizeOf(tt) > 1 ? root("event.order.priceAdmits", { price: formatMinor(tt.priceMinor, tt.currency), count: groupSizeOf(tt) }) : formatMinor(tt.priceMinor, tt.currency)}
              </span>
              <span className={b.qty}>
                <Select name={`qty_${tt.id}`} value={qty[tt.id] ?? 0} disabled={paused} aria-label={root("event.order.howMany", { name: tt.name })}
                  onChange={(e) => setQty((q) => ({ ...q, [tt.id]: Number(e.target.value) }))}>
                  {Array.from({ length: maxQuantity(tt, qty, perBuyerLimit, true) + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              </span>
            </div>
          ))}
          <p className={b.note}>{held > 0 ? root("event.order.limitLeft", { count: perBuyerLimit, held }) : root("event.order.limit", { count: perBuyerLimit })}</p>
        </fieldset>

        <GuestDetails idPrefix="paid" ticketNames={ticketTypesInOrder(qty, ticketTypes).map((tt) => tt.name)} questions={questions} buyer={buyer} phone={phone}
          people={checkout.people} justVerified={checkout.justVerified} onSignedIn={checkout.signedIn} />
      </Card>

      <Card className={b.summary}>
        {summary}

        {total > 0 && !waitlist && (
          <div className={b.lines} aria-live="polite">
            {quote ? (
              <>
                {quote.lines.map((l) => (
                  <div className={b.line} key={l.ticketTypeId}>
                    <span>{summaryLine(tb, l.name, l.quantity, l.groupSize)}</span><span>{formatMinor(l.unitPriceMinor * l.quantity, quote.currency)}</span>
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
                    <span>{tb("discount", { code: isolate(quote.discountCode ?? "") })}</span><span>{formatMinor(-quote.discountMinor, quote.currency)}</span>
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
        {!waitlist && !paused && (
          <DiscountCode code={discount.code} confirmed={!!quote?.discountCode} error={discount.codeError} applying={discount.applying}
            initialInput={initialCode ?? ""} onApply={discount.apply} onRemove={discount.remove} />
        )}

        <div className={b.terms}>
          {refundPolicy && <p><b>{t("refundPolicy")}</b> {refundPolicy}</p>}
          <p className={b.muted}>{root(ORGANIZER_KEY)}</p>
          <Checkbox name="non_refundable" required label={root(NON_REFUNDABLE_KEY)} className={b.check} />
        </div>

        {state?.error && <p className={b.error} role="alert">{state.error}</p>}

        {!waitlist && !paused && (
          <>
            <p className={b.note}>{t("payNote", { provider: providerLabel })}</p>
            <ul className={b.methods} aria-label={t("methodsLabel", { provider: providerLabel })}>
              {PROVIDER_METHODS[payOn].map((m) => <li key={m}><Badge tone="neutral" plain>{t(`methods.${m}`)}</Badge></li>)}
            </ul>
          </>
        )}
        <Button variant="primary" size="lg" fullWidth type="submit" loading={pending} disabled={paused || !buyer.signedIn || total === 0 || !valid}>
          {pending ? (waitlist ? t("joining") : t("opening", { provider: providerLabel })) : waitlist ? t("join") : quote ? t("payTotal", { provider: providerLabel, total: formatMinor(quote.totalMinor, quote.currency) }) : t("pay", { provider: providerLabel })}
        </Button>
        {paused ? null : !buyer.signedIn ? <p className={b.note}>{tv("confirmFirst")}</p> : total > 0 && !valid && !pending && <p className={b.note}>{tb("completeForm")}</p>}
      </Card>
    </form>
  );
}
