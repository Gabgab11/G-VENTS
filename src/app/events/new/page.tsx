"use client";

import { useActionState, useState } from "react";
import { createEvent, type CreateEventState } from "@/app/events/actions";
import { CATEGORIES } from "@/lib/categories";

type Tier = { name: string; price: string; qty: string };

const EMPTY = {
  title: "", category: "Music", date: "", time: "", venue: "", city: "", country: "",
  description: "", refund_policy: "",
};

export default function NewEventPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState(EMPTY);
  const [tiers, setTiers] = useState<Tier[]>([{ name: "General", price: "0", qty: "" }]);
  const [state, formAction, pending] = useActionState<CreateEventState, FormData>(createEvent, undefined);
  const [localError, setLocalError] = useState<string | null>(null);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function updateTier(i: number, key: keyof Tier, value: string) {
    setTiers((t) => t.map((x, idx) => (idx === i ? { ...x, [key]: value } : x)));
  }

  function goNext() {
    setLocalError(null);
    if (step === 1) {
      if (draft.title.trim().length < 3) return setLocalError("Give the event a name of at least 3 characters.");
      if (!draft.date || !draft.time) return setLocalError("Add a date and start time.");
    }
    if (step === 2) {
      if (tiers.length === 0) return setLocalError("Add at least one ticket.");
      if (tiers.some((t) => !t.name.trim())) return setLocalError("Every ticket needs a name.");
    }
    setStep((s) => (s + 1) as 1 | 2 | 3);
  }

  return (
    <main className="wrap page">
      <div className="steps" aria-label={`Step ${step} of 3`}>
        {[1, 2, 3].map((n) => <i key={n} className={n <= step ? "on" : ""} />)}
      </div>
      <p className="muted">Step {step} of 3 · {step === 1 ? "Basics" : step === 2 ? "Tickets" : "Review"}</p>

      {step === 1 && (
        <div className="form">
          <label className="field"><span>Event name</span>
            <input className="input" value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Night of Worship" /></label>
          <label className="field"><span>Category</span>
            <select className="input" value={draft.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select></label>
          <div className="row2">
            <label className="field"><span>Date</span>
              <input className="input" type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} /></label>
            <label className="field"><span>Start time (Lagos)</span>
              <input className="input" type="time" value={draft.time} onChange={(e) => set("time", e.target.value)} /></label>
          </div>
          <label className="field"><span>Venue</span>
            <input className="input" value={draft.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Venue name or online link" /></label>
          <div className="row2">
            <label className="field"><span>City</span>
              <input className="input" value={draft.city} onChange={(e) => set("city", e.target.value)} /></label>
            <label className="field"><span>Country</span>
              <input className="input" value={draft.country} onChange={(e) => set("country", e.target.value)} /></label>
          </div>
          <label className="field"><span>About this event</span>
            <textarea className="input" rows={5} value={draft.description} onChange={(e) => set("description", e.target.value)} /></label>
        </div>
      )}

      {step === 2 && (
        <div className="form">
          {tiers.map((t, i) => (
            <div className="tier-card" key={i}>
              <label className="field"><span>Ticket name</span>
                <input className="input" value={t.name} onChange={(e) => updateTier(i, "name", e.target.value)} /></label>
              <div className="row2">
                <label className="field"><span>Price (₦, 0 for free)</span>
                  <input className="input" inputMode="numeric" value={t.price} onChange={(e) => updateTier(i, "price", e.target.value)} /></label>
                <label className="field"><span>Quantity (blank = unlimited)</span>
                  <input className="input" inputMode="numeric" value={t.qty} onChange={(e) => updateTier(i, "qty", e.target.value)} /></label>
              </div>
              {tiers.length > 1 && (
                <button type="button" className="link-btn" onClick={() => setTiers((x) => x.filter((_, idx) => idx !== i))}>Remove ticket</button>
              )}
            </div>
          ))}
          <button type="button" className="btn-ghost" onClick={() => setTiers((x) => [...x, { name: "", price: "0", qty: "" }])}>+ Add ticket</button>
          <label className="field"><span>Refund policy</span>
            <textarea className="input" rows={3} value={draft.refund_policy} onChange={(e) => set("refund_policy", e.target.value)} placeholder="e.g. Full refund up to 7 days before the event" /></label>
        </div>
      )}

      {step === 3 && (
        <div className="form">
          <div className="review">
            <h2>{draft.title}</h2>
            <p className="muted">{draft.category} · {draft.date} · {draft.time} (Lagos)</p>
            <p className="muted">{[draft.venue, draft.city, draft.country].filter(Boolean).join(", ") || "No location yet"}</p>
            {draft.description && <p className="desc">{draft.description}</p>}
            <div className="tickets-sum">
              {tiers.map((t, i) => (
                <div className="summary-line" key={i}>
                  <span>{t.name}{t.qty ? ` (${t.qty})` : ""}</span>
                  <span>{Number(t.price) === 0 ? "Free" : `₦${Number(t.price).toLocaleString()}`}</span>
                </div>
              ))}
            </div>
          </div>

          <form action={formAction} className="form" style={{ gap: 12 }}>
            <input type="hidden" name="title" value={draft.title} />
            <input type="hidden" name="category" value={draft.category} />
            <input type="hidden" name="date" value={draft.date} />
            <input type="hidden" name="time" value={draft.time} />
            <input type="hidden" name="venue" value={draft.venue} />
            <input type="hidden" name="city" value={draft.city} />
            <input type="hidden" name="country" value={draft.country} />
            <input type="hidden" name="description" value={draft.description} />
            <input type="hidden" name="refund_policy" value={draft.refund_policy} />
            {tiers.map((t, i) => (
              <span key={i}>
                <input type="hidden" name="tier_name" value={t.name} />
                <input type="hidden" name="tier_price" value={t.price || "0"} />
                <input type="hidden" name="tier_qty" value={t.qty} />
              </span>
            ))}
            <button className="btn-grad" type="submit" name="intent" value="publish" disabled={pending}>{pending ? "Publishing..." : "Publish event"}</button>
            <button className="btn-ghost" type="submit" name="intent" value="draft" disabled={pending}>Save as draft</button>
          </form>
        </div>
      )}

      {(localError || state?.error) && <p className="error">{localError || state?.error}</p>}

      <div className="nav-row">
        {step > 1 && <button type="button" className="link-btn" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>← Back</button>}
        {step < 3 && <button type="button" className="btn-white" onClick={goNext}>Next</button>}
      </div>
    </main>
  );
}
