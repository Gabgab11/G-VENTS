"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { MAPS_URL_HINT, isGoogleMapsUrl } from "@/lib/maps-url";
import { createEvent, type CreateEventState } from "@/app/events/actions";
import { CATEGORIES } from "@/lib/categories";
import { THEMES, themeBackground } from "@/lib/themes";
import ThemeStage from "@/components/ThemeStage";
import MirrorBall from "@/components/MirrorBall";
import LocationFields from "./LocationFields";
import DateTimeWheel from "./DateTimeWheel";
import SiteHeader from "@/components/SiteHeader";
import Link from "next/link";
import { currencySymbol } from "@/lib/money";
import { FEE_CHOICES, sellReasonText, type FeeChoice } from "@/lib/payment-text";
import FeeExample from "./FeeExample";

type Tier = { id: number; name: string; price: string; qty: string };

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_MAX = 5 * 1024 * 1024;
let nextId = 2;

export default function NewEventForm({
  defaultTheme,
  detectedCountry,
  placesEnabled,
  paid = { canSell: false, currency: null, reason: "payments_off" },
}: {
  defaultTheme: string;
  detectedCountry: string | null;
  placesEnabled: boolean;
  /** Paid tickets (M5): allowed now, in the payout country's currency; otherwise why not. */
  paid?: { canSell: boolean; currency: string | null; reason: string | null };
}) {
  const paidAvailable = paid.canSell && !!paid.currency;
  const paidCurrency = paid.currency ?? "NGN";
  const notPaid = sellReasonText(paid.reason);
  const [feeChoice, setFeeChoice] = useState<FeeChoice>("host_absorbs");
  const [state, formAction, pending] = useActionState<CreateEventState, FormData>(createEvent, undefined);
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState(defaultTheme);
  const [tiers, setTiers] = useState<Tier[]>([{ id: 1, name: "General admission", price: "0", qty: "" }]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [isFree, setIsFree] = useState(true);
  const [online, setOnline] = useState(false);
  // "" = let the API take the zone from the venue (coordinates, or a country with one zone).
  const [timeZone, setTimeZone] = useState("");
  const [browserZone, setBrowserZone] = useState("Africa/Lagos");
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [imageError, setImageError] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  function chooseImage(file: File | undefined) {
    setImageError("");
    if (!file) { setImage(null); return; }
    let problem = "";
    if (!IMAGE_TYPES.includes(file.type)) problem = "Use a JPG, PNG, or WebP image.";
    else if (file.size > IMAGE_MAX) problem = "That image is larger than 5 MB. Please resize it and try again.";
    if (problem) {
      setImageError(problem);
      if (imageInput.current) imageInput.current.value = "";
      setImage(null);
      return;
    }
    setImage({ url: URL.createObjectURL(file), name: file.name });
  }

  function removeImage() {
    if (imageInput.current) imageInput.current.value = "";
    setImage(null);
    setImageError("");
  }
  const zones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  useEffect(() => setBrowserZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos"), []);

  const [start, setStart] = useState({ date: "", time: "" });
  const [end, setEnd] = useState({ date: "", time: "" });
  const [attempted, setAttempted] = useState(false);
  const timesMissing = !start.date || !start.time || !end.date || !end.time;

  // Start and end are required. The browser can't check the hidden wheel inputs, so check here.
  const [mapsError, setMapsError] = useState("");

  // The form is sent from here rather than by React's form action: after an action React clears
  // every field it doesn't manage, including the chosen image, so a refused submit (say, a wrong
  // Maps link) used to lose the image while its preview stayed on screen. Sending the FormData
  // ourselves keeps every field as typed. The `action` stays for submits before JavaScript loads.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const mapsUrl = (form.elements.namedItem("maps_url") as HTMLInputElement | null)?.value.trim() ?? "";
    const badMaps = mapsUrl !== "" && !isGoogleMapsUrl(mapsUrl);
    setMapsError(badMaps ? MAPS_URL_HINT : "");
    if (timesMissing) setAttempted(true);
    if (timesMissing || badMaps) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(form, submitter instanceof HTMLButtonElement ? submitter : null);
    startTransition(() => formAction(data));
  }

  function updateTier(id: number, key: keyof Omit<Tier, "id">, value: string) {
    setTiers((t) => t.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
  }

  return (
    <main className="wrap stage-content">
      <ThemeStage theme={theme} />
      <MirrorBall />
      <SiteHeader back="/dashboard" current="/events/new" />
      <header className="create-head">
        <h1>Create an event</h1>
        <p className="muted">Add the details, then share one link so guests can register.</p>
      </header>
      <form action={formAction} className="create-grid" onSubmit={onSubmit} noValidate>
        {/* LEFT: cover and design */}
        <aside className="create-cover">
          <div className={`cover-preview ${image ? "has-image" : ""}`} style={{ background: themeBackground(theme) }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local preview (blob: URL) of the chosen file */}
            {image && <img className="cover-image" src={image.url} alt="" />}
            <div className="cover-title">{title || "Your event"}</div>
          </div>

          <div className="panel">
            <div className="panel-label">Event image</div>
            <p className="muted small">Shown on the event page and in Discover. JPG, PNG, or WebP, up to 5 MB. Tall or square works best.</p>
            <input ref={imageInput} id="event-image" className="sr-only" type="file" name="flyer"
              accept={IMAGE_TYPES.join(",")} onChange={(e) => chooseImage(e.target.files?.[0])} />
            <div className="image-pick">
              <label htmlFor="event-image" className="btn-ghost">{image ? "Change image" : "Add an image"}</label>
              {image && <button type="button" className="link-btn" onClick={removeImage}>Remove</button>}
            </div>
            {image && <p className="muted small image-name">{image.name}</p>}
            {imageError && <p className="error" role="alert">{imageError}</p>}
            {!image && <p className="muted small">No image? The cover style below is used instead.</p>}
          </div>

          <div className="panel">
            <div className="panel-label">Cover style</div>
            <div className="theme-grid">
              {Object.entries(THEMES).map(([key, t]) => (
                <button type="button" key={key} className={`theme-swatch ${theme === key ? "on" : ""}`}
                  style={{ background: t.background }} onClick={() => setTheme(key)} aria-label={t.label}>
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
            <div className="panel-label">When</div>
            <div className="row2">
              <div className="field"><span>Starts <b className="req">*</b></span>
                <DateTimeWheel label="start" dateName="date" timeName="time" date={start.date} time={start.time}
                  invalid={attempted} onChange={setStart} /></div>
              <div className="field"><span>Ends <b className="req">*</b></span>
                <DateTimeWheel label="end" dateName="end_date" timeName="end_time" date={end.date} time={end.time}
                  invalid={attempted} onChange={setEnd} /></div>
            </div>
            {attempted && timesMissing && <p className="error">Add both a start and an end date and time.</p>}
            <label className="field"><span>Time zone</span>
              <select className="input" name="time_zone" value={online && !timeZone ? browserZone : timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                {!online && <option value="">From the venue</option>}
                {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
              </select></label>
            <p className="muted small">
              {online || timeZone
                ? "Times are in the time zone above. Guests see them in the event's time zone."
                : "Times are in the venue's local time. For countries with several time zones, pick the venue from the search or choose a zone."}
            </p>
          </div>

          <div className="panel">
            <div className="option">
              <div>
                <div className="option-title">Online event</div>
                <div className="muted small">No venue; guests get the details from you.</div>
              </div>
              <label className="switch"><input type="checkbox" name="is_online" checked={online} onChange={(e) => setOnline(e.target.checked)} /><span /></label>
            </div>
            {!online && <LocationFields detectedCountry={detectedCountry} placesEnabled={placesEnabled} />}
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
            <div className="ticket-type" role="group" aria-label="Ticket kind">
              <button type="button" className={isFree ? "on" : ""} aria-pressed={isFree} onClick={() => { setIsFree(true); setTiers((t) => t.map((x) => ({ ...x, price: "0" }))); }}>Free</button>
              {/* Paid needs Paystack on for the host's payout country, approval, and nothing owed (M5). */}
              <button type="button" className={!isFree ? "on" : ""} aria-pressed={!isFree} disabled={!paidAvailable}
                onClick={() => { setIsFree(false); setTiers((t) => t.map((x) => ({ ...x, price: x.price === "0" ? "" : x.price }))); }}
                aria-describedby={paidAvailable ? undefined : "paid-why"}>Paid{!paidAvailable && paid.reason === "payments_off" && <span className="soon-tag"> Coming soon</span>}</button>
            </div>
            {!paidAvailable && (
              <p className="muted small" id="paid-why">
                {notPaid.text}{" "}
                {notPaid.action && <Link href="/account/payouts" className="gold">{notPaid.action}</Link>}
              </p>
            )}
            {!isFree && (
              <div className="fee-choice">
                <p className="muted small">Prices are in {paidCurrency}, your payout country&apos;s currency, in whole {paidCurrency}. A price of 0 makes that ticket free.</p>
                <div className="option-title" id="fee-choice-label">Who pays the fees?</div>
                <div className="seg" role="radiogroup" aria-labelledby="fee-choice-label">
                  {(Object.keys(FEE_CHOICES) as FeeChoice[]).map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={feeChoice === k} className={feeChoice === k ? "on" : ""} onClick={() => setFeeChoice(k)}>
                      {FEE_CHOICES[k].label}
                    </button>
                  ))}
                </div>
                <p className="muted small">{FEE_CHOICES[feeChoice].hint}</p>
              </div>
            )}
            <input type="hidden" name="fee_choice" value={feeChoice} />
            {tiers.map((t) => (
              <div className="tier-card" key={t.id}>
                <div className="row2">
                  <label className="field"><span>Ticket name</span>
                    <input className="input" name="tier_name" value={t.name} onChange={(e) => updateTier(t.id, "name", e.target.value)} /></label>
                  <label className="field"><span>Quantity (blank = unlimited)</span>
                    <input className="input" name="tier_qty" inputMode="numeric" value={t.qty} onChange={(e) => updateTier(t.id, "qty", e.target.value)} /></label>
                </div>
                {!isFree && (
                  <>
                    <label className="field"><span>Price ({currencySymbol(paidCurrency)})</span>
                      <input className="input" name="tier_price" inputMode="numeric" placeholder="e.g. 5000" value={t.price} onChange={(e) => updateTier(t.id, "price", e.target.value)} /></label>
                    <FeeExample price={t.price} currency={paidCurrency} feeChoice={feeChoice} />
                  </>
                )}
                {isFree && <input type="hidden" name="tier_price" value="0" />}
                {tiers.length > 1 && (
                  <button type="button" className="link-btn" onClick={() => setTiers((x) => x.filter((y) => y.id !== t.id))}>Remove ticket</button>
                )}
              </div>
            ))}
            <button type="button" className="btn-ghost" onClick={() => setTiers((x) => [...x, { id: nextId++, name: "", price: isFree ? "0" : "", qty: "" }])}>+ Add ticket type</button>
            <label className="field"><span>Max tickets per person</span>
              <select className="input" name="per_buyer_limit" defaultValue="10">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </select></label>
          </div>

          <div className="panel">
            <div className="panel-label">Event options</div>

            <div className="option">
              <div>
                <div className="option-title">Who can find it</div>
                <div className="muted small">Public events appear in Discover. Private events open only by link.</div>
              </div>
              <div className="seg">
                <button type="button" className={visibility === "public" ? "on" : ""} onClick={() => setVisibility("public")}>Public</button>
                <button type="button" className={visibility === "private" ? "on" : ""} onClick={() => setVisibility("private")}>Private</button>
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
            {!isFree && <p className="muted small">Paid tickets are non-refundable except if the event is cancelled; guests see your policy next to that before they pay. You can still refund a ticket yourself from the guest list.</p>}
          </div>

          {mapsError && <p className="error" role="alert">{mapsError}</p>}
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
