"use client";

import { useActionState } from "react";
import { registerGuest, type RegisterState } from "./actions";

type Tier = { id: string; name: string; price_minor: number; quantity: number | null; sold: number };
type Question = { id: string; label: string; kind: string; options: string[]; required: boolean };

export default function RegisterForm({ eventId, tiers, questions, userEmail }: { eventId: string; tiers: Tier[]; questions: Question[]; userEmail: string }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerGuest, undefined);

  if (state?.status) {
    if (state.status === "waitlisted") {
      return (
        <div className="done">
          <b>You&apos;re on the waiting list</b>
          <p className="muted">The event is full. We&apos;ll contact you if a place opens.</p>
        </div>
      );
    }
    if (state.status === "pending") {
      return (
        <div className="done">
          <b>Your ticket is reserved</b>
          <p className="muted">Payment is the next step.</p>
        </div>
      );
    }
    return (
      <div className="done">
        <b>You&apos;re registered</b>
        <p className="muted">Keep this ticket code. You&apos;ll show it at the door.</p>
        {state.ticketCode && <div className="ticket-code">{state.ticketCode}</div>}
      </div>
    );
  }

  const hasTiers = tiers.length > 0;

  return (
    <form action={action} className="form register">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="questions_json" value={JSON.stringify(questions.map((q) => ({ id: q.id, label: q.label, kind: q.kind, required: q.required })))} />

      {hasTiers && (
        <div className="form" style={{ gap: 8 }}>
          {tiers.map((t, i) => {
            const soldOut = t.quantity !== null && t.sold >= t.quantity;
            return (
              <label key={t.id} className={`tier-pick ${soldOut ? "disabled" : ""}`}>
                <input type="radio" name="tier_id" value={t.id} defaultChecked={i === 0} disabled={soldOut} />
                <span className="grow">{t.name}</span>
                <span>{soldOut ? "Sold out" : t.price_minor === 0 ? "Free" : `₦${(t.price_minor / 100).toLocaleString()}`}</span>
              </label>
            );
          })}
        </div>
      )}
      {!hasTiers && <input type="hidden" name="tier_id" value="" />}

      <label className="field"><span>Full name</span>
        <input className="input" name="name" required minLength={2} /></label>
      <label className="field"><span>Email</span>
        <input className="input" name="email" type="email" required defaultValue={userEmail} /></label>

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
            <input className="input" name={`q_${q.id}`} type={q.kind === "phone" ? "tel" : q.kind === "website" ? "url" : "text"}
              required={q.required} placeholder={q.kind === "social" ? "@handle or profile link" : ""} />
          )}
        </label>
      ))}

      {state?.error && <p className="error">{state.error}</p>}

      <button className="btn-white" type="submit" disabled={pending}>{pending ? "Registering..." : "Register"}</button>
    </form>
  );
}
