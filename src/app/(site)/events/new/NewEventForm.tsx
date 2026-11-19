"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MAPS_URL_HINT_KEY, isGoogleMapsUrl } from "@/lib/maps-url";
import { createEvent, type CreateEventState } from "@/app/(site)/events/actions";
import { CATEGORIES, categoryLabelKey } from "@/lib/categories";
import { THEMES, themeBackground } from "@/lib/themes";
import ThemeStage from "@/components/ThemeStage";
import MirrorBall from "@/components/MirrorBall";
import LocationFields from "./LocationFields";
import DateTimeWheel from "./DateTimeWheel";
import TimeZoneField, { type ZoneContext } from "./TimeZoneField";
import SiteHeader from "@/components/SiteHeader";
import Link from "next/link";
import { currencySymbol } from "@/lib/money";
import { FEE_CHOICES, feeChoiceKey, sellReasonKey, type FeeChoice } from "@/lib/payment-text";
import FeeExample from "./FeeExample";
import { Button, Card, Field, Input, Select, Textarea } from "@/design";
import { Switch } from "@/design/client";
import styles from "./NewEventForm.module.css";

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
  const t = useTranslations("createEvent");
  const root = useTranslations();
  const paidAvailable = paid.canSell && !!paid.currency;
  const paidCurrency = paid.currency ?? "NGN";
  const notPaid = sellReasonKey(paid.reason);
  const [feeChoice, setFeeChoice] = useState<FeeChoice>("host_absorbs");
  const [state, formAction, pending] = useActionState<CreateEventState, FormData>(createEvent, undefined);
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState(defaultTheme);
  const [tiers, setTiers] = useState<Tier[]>([{ id: 1, name: t("form.tickets.defaultName"), price: "0", qty: "" }]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [isFree, setIsFree] = useState(true);
  const [online, setOnline] = useState(false);
  // The time zone follows the venue (TimeZoneField); LocationFields reports the country's zones and the venue's.
  const [zoneContext, setZoneContext] = useState<ZoneContext>({ countryName: "", countryZones: [], venueZone: null });
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [imageError, setImageError] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);
  // The chosen image, held back from the Server Action and sent to the flyer route once the event
  // exists (Cloudflare's WAF blocks some images sent to Server Actions, src/lib/same-origin.ts).
  const pendingImage = useRef<File | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const created = state?.created;
    if (!created) return;
    const file = pendingImage.current;
    pendingImage.current = null;
    setSendingImage(true);
    void (async () => {
      let ok = !file;
      if (file) {
        const body = new FormData();
        body.set("flyer", file);
        const res = await fetch(`/api/events/${created.id}/flyer`, { method: "POST", body, headers: { Accept: "application/json" } }).catch(() => null);
        ok = !!res?.ok;
      }
      router.push(ok ? created.next : `/dashboard/${created.id}?tab=settings&err=flyer_after_create`);
    })();
  }, [state, router]);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  function chooseImage(file: File | undefined) {
    setImageError("");
    if (!file) { setImage(null); return; }
    let problem = "";
    if (!IMAGE_TYPES.includes(file.type)) problem = t("form.image.wrongType");
    else if (file.size > IMAGE_MAX) problem = t("form.image.tooLarge");
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
    setMapsError(badMaps ? root(MAPS_URL_HINT_KEY) : "");
    if (timesMissing) setAttempted(true);
    if (timesMissing || badMaps) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(form, submitter instanceof HTMLButtonElement ? submitter : null);
    const file = data.get("flyer");
    data.delete("flyer");
    if (file instanceof File && file.size > 0) {
      pendingImage.current = file;
      data.set("image_pending", "1");
    } else {
      pendingImage.current = null;
    }
    startTransition(() => formAction(data));
  }

  function updateTier(id: number, key: keyof Omit<Tier, "id">, value: string) {
    setTiers((list) => list.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
  }

  return (
    <main className="wrap stage-content">
      <ThemeStage theme={theme} />
      <MirrorBall />
      <SiteHeader back="/dashboard" current="/events/new" />
      <header className="create-head">
        <h1>{t("form.title")}</h1>
        <p className="muted">{t("form.intro")}</p>
      </header>
      <form action={formAction} className="create-grid" onSubmit={onSubmit} noValidate>
        {/* LEFT: cover and design */}
        <aside className="create-cover">
          <div className={`cover-preview ${image ? "has-image" : ""}`} style={{ background: themeBackground(theme) }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local preview (blob: URL) of the chosen file */}
            {image && <img className="cover-image" src={image.url} alt="" />}
            <div className="cover-title">{title || t("form.coverTitle")}</div>
          </div>

          <Card>
            <div className="panel-label">{t("form.image.label")}</div>
            <p className="muted small">{t("form.image.help")}</p>
            <input ref={imageInput} id="event-image" className="sr-only" type="file" name="flyer"
              accept={IMAGE_TYPES.join(",")} onChange={(e) => chooseImage(e.target.files?.[0])} />
            <div className="image-pick">
              <label htmlFor="event-image" className="btn-ghost">{image ? t("form.image.change") : t("form.image.add")}</label>
              {image && <button type="button" className="link-btn" onClick={removeImage}>{t("form.image.remove")}</button>}
            </div>
            {image && <p className="muted small image-name">{image.name}</p>}
            {imageError && <p className="error" role="alert">{imageError}</p>}
            {!image && <p className="muted small">{t("form.image.none")}</p>}
          </Card>

          <Card>
            <div className="panel-label">{t("form.coverStyle")}</div>
            <div className="theme-grid">
              {Object.entries(THEMES).map(([key, th]) => {
                const label = t.has(`themes.${key}`) ? t(`themes.${key}`) : th.label;
                return (
                <button type="button" key={key} className={`theme-swatch ${theme === key ? "on" : ""}`}
                  style={{ background: th.background }} onClick={() => setTheme(key)} aria-label={label}>
                  <span>{label}</span>
                </button>
                );
              })}
            </div>
            <input type="hidden" name="cover_theme" value={theme} />
          </Card>
        </aside>

        {/* RIGHT: details */}
        <section className="create-main">
          <input className="title-input" name="title" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={t("form.eventName")} maxLength={140} required />

          <Card>
            <div className="panel-label">{t("form.when.label")}</div>
            <div className="row2">
              <div className="field"><span>{t("form.when.starts")} <b className="req">*</b></span>
                <DateTimeWheel label={t("form.when.start")} dateName="date" timeName="time" date={start.date} time={start.time}
                  invalid={attempted} onChange={setStart} /></div>
              <div className="field"><span>{t("form.when.ends")} <b className="req">*</b></span>
                <DateTimeWheel label={t("form.when.end")} dateName="end_date" timeName="end_time" date={end.date} time={end.time}
                  invalid={attempted} onChange={setEnd} /></div>
            </div>
            {attempted && timesMissing && <p className="error">{t("form.when.missing")}</p>}
            <TimeZoneField online={online} context={zoneContext} />
          </Card>

          <Card>
            <div className="option">
              <div>
                <div className="option-title" id="opt-online">{t("online.title")}</div>
                <div className="muted small" id="opt-online-help">{t("online.help")}</div>
              </div>
              <Switch name="is_online" checked={online} onCheckedChange={setOnline} aria-labelledby="opt-online" aria-describedby="opt-online-help" />
            </div>
            {!online && <LocationFields detectedCountry={detectedCountry} placesEnabled={placesEnabled} onZoneContext={setZoneContext} />}
          </Card>

          <Card>
            <Field label={t("form.category")}>
              <Select name="category" defaultValue="Music">
                {CATEGORIES.map((c) => <option key={c} value={c}>{root(categoryLabelKey(c))}</option>)}
              </Select>
            </Field>
            <Field label={t("form.about")}>
              <Textarea name="description" rows={6} placeholder={t("form.aboutPlaceholder")} />
            </Field>
          </Card>

          <Card>
            <div className="panel-label">{t("form.tickets.label")}</div>
            <div className="ticket-type" role="group" aria-label={t("form.tickets.kind")}>
              <button type="button" className={isFree ? "on" : ""} aria-pressed={isFree} onClick={() => { setIsFree(true); setTiers((list) => list.map((x) => ({ ...x, price: "0" }))); }}>{t("form.tickets.free")}</button>
              {/* Paid needs Paystack on for the host's payout country, approval, and nothing owed (M5). */}
              <button type="button" className={!isFree ? "on" : ""} aria-pressed={!isFree} disabled={!paidAvailable}
                onClick={() => { setIsFree(false); setTiers((list) => list.map((x) => ({ ...x, price: x.price === "0" ? "" : x.price }))); }}
                aria-describedby={paidAvailable ? undefined : "paid-why"}>{t("form.tickets.paid")}{!paidAvailable && paid.reason === "payments_off" && <span className="soon-tag">{" "}{t("form.tickets.comingSoon")}</span>}</button>
            </div>
            {!paidAvailable && (
              <p className="muted small" id="paid-why">
                {root(notPaid.key)}{" "}
                {notPaid.actionKey && <Link href="/account/payouts" className="gold">{root(notPaid.actionKey)}</Link>}
              </p>
            )}
            {!isFree && (
              <div className="fee-choice">
                <p className="muted small">{t("form.tickets.pricesIn", { currency: paidCurrency })}</p>
                <div className="option-title" id="fee-choice-label">{t("form.tickets.whoPays")}</div>
                <div className="seg" role="radiogroup" aria-labelledby="fee-choice-label">
                  {(Object.keys(FEE_CHOICES) as FeeChoice[]).map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={feeChoice === k} className={feeChoice === k ? "on" : ""} onClick={() => setFeeChoice(k)}>
                      {root(feeChoiceKey(k).labelKey)}
                    </button>
                  ))}
                </div>
                <p className="muted small">{root(feeChoiceKey(feeChoice).hintKey)}</p>
              </div>
            )}
            <input type="hidden" name="fee_choice" value={feeChoice} />
            {tiers.map((tier) => (
              <Card key={tier.id} className={styles.tier}>
                <div className="row2">
                  <Field label={t("form.tickets.name")}>
                    <Input name="tier_name" value={tier.name} onChange={(e) => updateTier(tier.id, "name", e.target.value)} />
                  </Field>
                  <Field label={t("form.tickets.quantity")}>
                    <Input name="tier_qty" inputMode="numeric" value={tier.qty} onChange={(e) => updateTier(tier.id, "qty", e.target.value)} />
                  </Field>
                </div>
                {!isFree && (
                  <>
                    <Field label={t("form.tickets.price", { symbol: currencySymbol(paidCurrency) })}>
                      <Input name="tier_price" inputMode="numeric" placeholder={t("form.tickets.pricePlaceholder")} value={tier.price} onChange={(e) => updateTier(tier.id, "price", e.target.value)} />
                    </Field>
                    <FeeExample price={tier.price} currency={paidCurrency} feeChoice={feeChoice} />
                  </>
                )}
                {isFree && <input type="hidden" name="tier_price" value="0" />}
                {tiers.length > 1 && (
                  <button type="button" className="link-btn" onClick={() => setTiers((x) => x.filter((y) => y.id !== tier.id))}>{t("form.tickets.remove")}</button>
                )}
              </Card>
            ))}
            <Button variant="secondary" onClick={() => setTiers((x) => [...x, { id: nextId++, name: "", price: isFree ? "0" : "", qty: "" }])}>{t("form.tickets.add")}</Button>
            <Field label={t("form.tickets.perPerson")}>
              <Select name="per_buyer_limit" defaultValue="10">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
          </Card>

          <Card>
            <div className="panel-label">{t("form.options.label")}</div>

            <div className="option">
              <div>
                <div className="option-title">{t("form.options.visibility")}</div>
                <div className="muted small">{t("form.options.visibilityHelp")}</div>
              </div>
              <div className="seg">
                <button type="button" className={visibility === "public" ? "on" : ""} onClick={() => setVisibility("public")}>{t("form.options.public")}</button>
                <button type="button" className={visibility === "private" ? "on" : ""} onClick={() => setVisibility("private")}>{t("form.options.private")}</button>
              </div>
              <input type="hidden" name="visibility" value={visibility} />
            </div>

            <div className="option">
              <div>
                <div className="option-title" id="opt-count">{t("form.options.attendeeCount")}</div>
                <div className="muted small" id="opt-count-help">{t("form.options.attendeeCountHelp")}</div>
              </div>
              <Switch name="show_attendee_count" defaultChecked aria-labelledby="opt-count" aria-describedby="opt-count-help" />
            </div>

            <div className="option">
              <div>
                <div className="option-title" id="opt-approval">{t("form.options.approval")}</div>
                <div className="muted small" id="opt-approval-help">{t("form.options.approvalHelp")}</div>
              </div>
              <Switch name="require_approval" aria-labelledby="opt-approval" aria-describedby="opt-approval-help" />
            </div>

            <Field label={t("form.options.refundPolicy")}>
              <Textarea name="refund_policy" rows={3} placeholder={t("form.options.refundPolicyPlaceholder")} />
            </Field>
            {!isFree && <p className="muted small">{t("form.options.paidRefundNote")}</p>}
          </Card>

          {mapsError && <p className="error" role="alert">{mapsError}</p>}
          {state?.error && <p className="error" role="alert">{state.error}</p>}

          <div className="publish-bar">
            <Button variant="secondary" className={styles.publishButton} type="submit" name="intent" value="draft" disabled={pending || sendingImage}>{t("form.saveDraft")}</Button>
            <Button variant="accent" className={styles.publishButton} type="submit" name="intent" value="publish" disabled={pending || sendingImage}>
              {pending || sendingImage ? t("form.creating") : t("form.create")}
            </Button>
          </div>
        </section>
      </form>
    </main>
  );
}
