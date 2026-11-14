"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { PageQuestion, PageTicketType } from "@/lib/event-page";
import { formatMinor } from "@/lib/money";
import { NON_REFUNDABLE_TEXT, ORGANIZER_TEXT, type FeeChoice } from "@/lib/payment-text";
import { placePaidOrder, quotePaid, type OrderState, type Quote } from "./actions";
import GuestDetails from "./GuestDetails";

type Props = {
  eventId: string;
  ticketTypes: PageTicketType[];
  questions: PageQuestion[];
  perBuyerLimit: number;
  userEmail: string;
  defaultName: string;
  refundPolicy: string | null;
  feeChoice: FeeChoice;
};

// Paid tickets (M5, CK1–CK4): paid ticket types only (free ones are a separate order), a live
// breakdown from the API's quote, the non-refundable tick box next to the event's refund policy and
// the organizer statement, then "Pay with Paystack". A sold-out type can be chosen to join its
// waiting list (WL1).
export default function PaidOrderForm({ eventId, ticketTypes, questions, perBuyerLimit, userEmail, defaultName, refundPolicy, feeChoice }: Props) {
  const [state, action, pending] = useActionState<OrderState, FormData>(placePaidOrder, undefined);
  const first = ticketTypes.find((t) => t.remaining === null || t.remaining > 0);
  const [qty, setQty] = useState<Record<string, number>>(first ? { [first.id]: 1 } : {});
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const total = Object.values(qty).reduce((a, b) => a + b, 0);
  const soldOut = (t: PageTicketType) => t.remaining !== null && t.remaining <= 0;
  const waitlist = ticketTypes.some((t) => soldOut(t) && (qty[t.id] ?? 0) > 0);
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

  const options = (t: PageTicketType) => {
    const others = total - (qty[t.id] ?? 0);
    const room = soldOut(t) ? perBuyerLimit : t.remaining ?? perBuyerLimit;
    const max = Math.max(0, Math.min(perBuyerLimit - others, room));
    return Array.from({ length: max + 1 }, (_, i) => i);
  };

  // Shown before the quote arrives, and if it can't be had: the plain sum of the prices.
  const subtotal = ticketTypes.reduce((sum, t) => sum + t.priceMinor * (qty[t.id] ?? 0), 0);

  return (
    <form action={action} className="form register">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="join_waitlist" value={waitlist ? "true" : "false"} />

      <fieldset className="form" style={{ gap: 8, border: 0 }}>
        <legend className="sr-only">Paid tickets</legend>
        {ticketTypes.map((t) => (
          <label key={t.id} className="tier-pick">
            <span className="grow">{t.name}</span>
            <span className="muted small">{soldOut(t) ? "Sold out · waiting list" : formatMinor(t.priceMinor, t.currency)}</span>
            <select className="input qty" name={`qty_${t.id}`} value={qty[t.id] ?? 0} aria-label={`How many ${t.name} tickets`}
              onChange={(e) => setQty((q) => ({ ...q, [t.id]: Number(e.target.value) }))}>
              {options(t).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        ))}
        <p className="muted small">Up to {perBuyerLimit} {perBuyerLimit === 1 ? "ticket" : "tickets"} per person.</p>
      </fieldset>

      {total > 0 && !waitlist && (
        <div className="pay-breakdown" aria-live="polite">
          {quote ? (
            <>
              {quote.lines.map((l) => (
                <div className="pay-line" key={l.ticketTypeId}>
                  <span>{l.name} × {l.quantity}</span><span>{formatMinor(l.unitPriceMinor * l.quantity, quote.currency)}</span>
                </div>
              ))}
              {quote.serviceFeeMinor > 0 && (
                <div className="pay-line">
                  <span>Service fee{quote.vatMinor > 0 ? <span className="muted small"> (includes VAT {formatMinor(quote.vatMinor, quote.currency)})</span> : null}</span>
                  <span>{formatMinor(quote.serviceFeeMinor, quote.currency)}</span>
                </div>
              )}
              <div className="pay-line pay-total"><span>Total</span><span>{formatMinor(quote.totalMinor, quote.currency)}</span></div>
              {quote.serviceFeeMinor === 0 && <p className="muted small">Fees are included in the price.</p>}
            </>
          ) : (
            <>
              <div className="pay-line"><span>Tickets</span><span>{formatMinor(subtotal, currency)}</span></div>
              <p className="muted small">{quoteError || (feeChoice === "guest_pays" ? "Working out the service fee..." : "Working out the total...")}</p>
            </>
          )}
        </div>
      )}
      {waitlist && <p className="muted small">That ticket is sold out. Join the waiting list and we&apos;ll email you if a place frees up; you then have 24 hours to pay.</p>}

      <GuestDetails idPrefix="paid" total={total} questions={questions} userEmail={userEmail} defaultName={defaultName} />

      <div className="pay-terms">
        {refundPolicy && <p className="small"><b>Refund policy:</b> {refundPolicy}</p>}
        <p className="small muted">{ORGANIZER_TEXT}</p>
        <label className="check">
          <input type="checkbox" name="non_refundable" required />
          <span>{NON_REFUNDABLE_TEXT}</span>
        </label>
      </div>

      {state?.error && <p className="error" role="alert">{state.error}</p>}

      <button className="btn-white" type="submit" disabled={pending || total === 0}>
        {pending ? (waitlist ? "Joining..." : "Opening Paystack...") : waitlist ? "Join the waiting list" : `Pay with Paystack${quote ? ` · ${formatMinor(quote.totalMinor, quote.currency)}` : ""}`}
      </button>
      {!waitlist && <p className="muted small">You&apos;ll pay on Paystack&apos;s secure page. Your tickets are held for 10 minutes.</p>}
    </form>
  );
}
