"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerGuest, type RegisterState } from "./actions";
import type { PageQuestion, PageTier } from "@/lib/event-page";

export default function RegisterForm({ eventId, tiers, questions, userEmail }: { eventId: string; tiers: PageTier[]; questions: PageQuestion[]; userEmail: string }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerGuest, undefined);

  if (state?.status) {
    if (state.status === "waitlisted") {
      return (
        <div className="done" role="status">
          <b>You&apos;re on the waiting list</b>
          <p className="muted">The event is full. If a place opens, we&apos;ll email your ticket.</p>
          {state.ticketCode && <Link className="pill" href={`/t/${state.ticketCode}`}>Follow your place</Link>}
        </div>
      );
    }
    if (state.status === "pending") {
      return (
        <div className="done" role="status">
          <b>Request received</b>
          <p className="muted">The host approves each registration. You&apos;ll hear from them once it&apos;s confirmed.</p>
        </div>
      );
    }
    return (
      <div className="done" role="status">
        <b>You&apos;re registered</b>
        <p className="muted">Your ticket has a QR code to show at the door. Check your email for a copy.</p>
        {state.ticketCode && <Link className="pill" href={`/t/${state.ticketCode}`}>View and print your ticket</Link>}
      </div>
    );
  }

  return (
    <form action={action} className="form register">
      <input type="hidden" name="event_id" value={eventId} />

      <fieldset className="form" style={{ gap: 8, border: 0 }}>
        <legend className="sr-only">Ticket</legend>
        {tiers.map((t, i) => {
          const soldOut = t.quantity !== null && t.sold >= t.quantity;
          return (
            <label key={t.id} className={`tier-pick ${soldOut ? "disabled" : ""}`}>
              <input type="radio" name="tier_id" value={t.id} defaultChecked={i === 0 && !soldOut} disabled={soldOut} required />
              <span className="grow">{t.name}</span>
              <span>{soldOut ? "Sold out" : "Free"}</span>
            </label>
          );
        })}
      </fieldset>

      <label className="field"><span>Full name</span>
        <input className="input" name="name" required minLength={2} maxLength={120} autoComplete="name" /></label>
      <label className="field"><span>Email</span>
        <input className="input" name="email" type="email" required maxLength={254} autoComplete="email" defaultValue={userEmail} /></label>

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

      <button className="btn-white" type="submit" disabled={pending}>{pending ? "Registering..." : "Register"}</button>
    </form>
  );
}
