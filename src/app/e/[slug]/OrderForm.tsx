"use client";

import { useActionState, useState } from "react";
import type { PageQuestion, PageTicketType } from "@/lib/event-page";
import { placeOrder, type OrderState } from "./actions";

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
  const [state, action, pending] = useActionState<OrderState, FormData>(placeOrder, undefined);
  const first = ticketTypes.find((t) => t.remaining === null || t.remaining > 0);
  const [qty, setQty] = useState<Record<string, number>>(first ? { [first.id]: 1 } : {});
  const total = Object.values(qty).reduce((a, b) => a + b, 0);

  const options = (t: PageTicketType) => {
    const others = total - (qty[t.id] ?? 0);
    const max = Math.max(0, Math.min(perBuyerLimit - others, t.remaining ?? perBuyerLimit));
    return Array.from({ length: max + 1 }, (_, i) => i);
  };

  return (
    <form action={action} className="form register">
      <input type="hidden" name="event_id" value={eventId} />

      <fieldset className="form" style={{ gap: 8, border: 0 }}>
        <legend className="sr-only">Tickets</legend>
        {ticketTypes.map((t) => {
          const soldOut = t.remaining !== null && t.remaining <= 0;
          return (
            <label key={t.id} className={`tier-pick ${soldOut ? "disabled" : ""}`}>
              <span className="grow">{t.name}</span>
              <span className="muted small">{soldOut ? "Sold out" : "Free"}</span>
              {!soldOut && (
                <select className="input qty" name={`qty_${t.id}`} value={qty[t.id] ?? 0} aria-label={`How many ${t.name} tickets`}
                  onChange={(e) => setQty((q) => ({ ...q, [t.id]: Number(e.target.value) }))}>
                  {options(t).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
            </label>
          );
        })}
        <p className="muted small">Up to {perBuyerLimit} {perBuyerLimit === 1 ? "ticket" : "tickets"} per person.</p>
      </fieldset>

      <label className="field"><span>Your full name</span>
        <input className="input" name="buyer_name" defaultValue={defaultName} minLength={2} maxLength={120} autoComplete="name" required={!defaultName} /></label>
      <label className="field"><span>Email</span>
        <input className="input" type="email" value={userEmail} readOnly aria-describedby="email-note" />
        <small id="email-note" className="muted">All your tickets are sent to your account email.</small></label>

      {total > 1 && (
        <fieldset className="form" style={{ gap: 8, border: 0 }}>
          <legend className="muted small">Names for the other tickets (optional; you can forward each ticket)</legend>
          {Array.from({ length: total - 1 }, (_, i) => (
            <label className="field" key={i}><span>Ticket {i + 2}</span>
              <input className="input" name={`guest_${i + 2}`} maxLength={120} placeholder="Guest name" /></label>
          ))}
        </fieldset>
      )}

      {questions.map((q) => (
        <label className="field" key={q.id}>
          {q.kind !== "terms" && <span>{q.label}{q.required ? " *" : ""}</span>}
          {q.kind === "options" ? (
            <select className="input" name={`q_${q.id}`} required={q.required} defaultValue="">
              <option value="" disabled>Choose</option>
              {q.options.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : q.kind === "terms" ? (
            <span className="check"><input type="checkbox" name={`q_${q.id}`} required={q.required} /> <span>{q.label}{q.required ? " *" : ""}</span></span>
          ) : (
            <input className="input" name={`q_${q.id}`} maxLength={1000}
              type={q.kind === "phone" ? "tel" : q.kind === "website" ? "url" : "text"}
              required={q.required} placeholder={q.kind === "social" ? "@handle or profile link" : ""} />
          )}
        </label>
      ))}

      {state?.error && <p className="error" role="alert">{state.error}</p>}

      <button className="btn-white" type="submit" disabled={pending || total === 0}>
        {pending ? "Getting your tickets..." : requireApproval ? `Request ${total === 1 ? "a ticket" : `${total} tickets`}` : `Get ${total === 1 ? "ticket" : `${total} tickets`}`}
      </button>
    </form>
  );
}
