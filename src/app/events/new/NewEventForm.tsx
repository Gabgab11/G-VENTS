"use client";

import { useActionState, useRef, useState } from "react";
import { createEvent, type CreateEventState } from "@/app/events/actions";
import { CATEGORIES } from "@/lib/categories";
import { THEMES, themeBackground } from "@/lib/themes";
import ThemeStage from "@/components/ThemeStage";
import BackLink from "@/components/BackLink";

type Tier = { id: number; name: string; qty: string };

export default function NewEventForm({ defaultTheme }: { defaultTheme: string }) {
  const [state, formAction, pending] = useActionState<CreateEventState, FormData>(createEvent, undefined);
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState(defaultTheme);
  const [tiers, setTiers] = useState<Tier[]>([{ id: 1, name: "General admission", qty: "" }]);
  const nextTierId = useRef(2);
  const [visibility, setVisibility] = useState<"public" | "private">("public");

  function updateTier(id: number, key: keyof Omit<Tier, "id">, value: string) {
    setTiers((t) => t.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
  }

  return (
    <main className="wrap stage-content">
      <ThemeStage theme={theme} />
      <div className="back-row"><BackLink fallback="/dashboard" label="← Dashboard" /></div>
      <form action={formAction} className="create-grid">
        {/* LEFT: cover and design */}
        <aside className="create-cover">
          <div className="cover-preview" style={{ background: themeBackground(theme) }}>
            <div className="cover-title">{title || "Your event"}</div>
          </div>

          <div className="panel">
            <div className="panel-label">Cover style</div>
            <div className="theme-grid">
              {Object.entries(THEMES).map(([key, t]) => (
                <button type="button" key={key} className={`theme-swatch ${theme === key ? "on" : ""}`}
                  style={{ background: t.background }} onClick={() => setTheme(key)} aria-label={t.label} aria-pressed={theme === key}>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            <input type="hidden" name="cover_theme" value={theme} />
          </div>
        </aside>

        {/* RIGHT: details */}
        <section className="create-main">
          <input className="title-input" name="title" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Event name" maxLength={140} required />

          <div className="panel">
            <div className="row2">
              <label className="field"><span>Starts</span>
                <div className="row2 tight">
                  <input className="input" type="date" name="date" required />
                  <input className="input" type="time" name="time" required />
                </div></label>
              <label className="field"><span>Ends (optional)</span>
                <div className="row2 tight">
                  <input className="input" type="date" name="end_date" />
                  <input className="input" type="time" name="end_time" />
                </div></label>
            </div>
            <p className="muted small">Times are in Lagos time (GMT+1).</p>
          </div>

          <div className="panel">
            <label className="field"><span>Location</span>
              <input className="input" name="venue" placeholder="Venue name, address, or online link" /></label>
            <div className="row2">
              <label className="field"><span>City</span><input className="input" name="city" /></label>
              <label className="field"><span>Country</span><input className="input" name="country" /></label>
            </div>
          </div>

          <div className="panel">
            <label className="field"><span>Category</span>
              <select className="input" name="category" defaultValue="Music">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select></label>
            <label className="field"><span>About this event</span>
              <textarea className="input" name="description" rows={6} placeholder="What should guests know?" /></label>
          </div>

          <div className="panel">
            <div className="panel-label">Tickets</div>
            <p className="muted small">Tickets are free for now. Paid tickets arrive when online payments are ready.</p>
            {tiers.map((t) => (
              <div className="tier-card" key={t.id}>
                <div className="row2">
                  <label className="field"><span>Ticket name</span>
                    <input className="input" name="tier_name" value={t.name} onChange={(e) => updateTier(t.id, "name", e.target.value)} /></label>
                  <label className="field"><span>Quantity (blank = unlimited)</span>
                    <input className="input" name="tier_qty" inputMode="numeric" value={t.qty} onChange={(e) => updateTier(t.id, "qty", e.target.value)} /></label>
                </div>
                {tiers.length > 1 && (
                  <button type="button" className="link-btn" onClick={() => setTiers((x) => x.filter((y) => y.id !== t.id))}>Remove ticket</button>
                )}
              </div>
            ))}
            <button type="button" className="btn-ghost" onClick={() => setTiers((x) => [...x, { id: nextTierId.current++, name: "", qty: "" }])}>+ Add ticket type</button>
          </div>

          <div className="panel">
            <div className="panel-label">Event options</div>

            <div className="option">
              <div>
                <div className="option-title">Who can find it</div>
                <div className="muted small">Public events appear in Discover. Private events open only by link.</div>
              </div>
              <div className="seg" role="group" aria-label="Who can find it">
                <button type="button" className={visibility === "public" ? "on" : ""} aria-pressed={visibility === "public"} onClick={() => setVisibility("public")}>Public</button>
                <button type="button" className={visibility === "private" ? "on" : ""} aria-pressed={visibility === "private"} onClick={() => setVisibility("private")}>Private</button>
              </div>
              <input type="hidden" name="visibility" value={visibility} />
            </div>

            <div className="option">
              <div>
                <div className="option-title">Show attendee count</div>
                <div className="muted small">Let guests see how many people are going.</div>
              </div>
              <label className="switch"><input type="checkbox" name="show_attendee_count" defaultChecked /><span /></label>
            </div>

            <div className="option">
              <div>
                <div className="option-title">Require approval</div>
                <div className="muted small">You approve each registration before it is confirmed.</div>
              </div>
              <label className="switch"><input type="checkbox" name="require_approval" /><span /></label>
            </div>

            <label className="field"><span>Refund policy</span>
              <textarea className="input" name="refund_policy" rows={3} placeholder="e.g. Full refund up to 7 days before the event" /></label>
          </div>

          {state?.error && <p className="error" role="alert">{state.error}</p>}

          <div className="publish-bar">
            <button className="btn-ghost" type="submit" name="intent" value="draft" disabled={pending}>Save as draft</button>
            <button className="btn-grad" type="submit" name="intent" value="publish" disabled={pending}>
              {pending ? "Creating..." : "Create event"}
            </button>
          </div>
        </section>
      </form>
    </main>
  );
}
