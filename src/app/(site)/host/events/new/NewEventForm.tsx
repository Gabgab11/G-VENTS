"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { createEvent, type CreateEventState } from "@/app/(site)/events/actions";
import { CATEGORIES, categoryLabelKey } from "@/lib/categories";
import { THEMES, themeBackground } from "@/lib/themes";
import { currencySymbol } from "@/lib/money";
import { GROUP_MAX, GROUP_MIN, TICKET_DESCRIPTION_MAX } from "@/lib/group-tickets";
import { FEE_CHOICES, feeChoiceKey, sellReasonKey, type FeeChoice } from "@/lib/payment-text";
import { Badge, Banner, Button, Card, CardHeader, Field, Input, Link, PageHeader, Select, Textarea } from "@/design";
import { Switch } from "@/design/client";
import LocationFields from "./LocationFields";
import DateTimeWheel from "./DateTimeWheel";
import TimeZoneField, { type ZoneContext } from "./TimeZoneField";
import FeeExample from "./FeeExample";
import PictureManager, { measurePicture } from "@/components/PictureManager";
import { movePicture } from "@/lib/picture-list";
import { uploadPicture } from "@/lib/picture-upload";
import { LAST_STEP, STEPS, canVisit, checkStep, nextStep, previousStep, stepOfField } from "./steps";
import styles from "./NewEventForm.module.css";

type Tier = { id: number; name: string; price: string; qty: string; desc: string; group: boolean; size: string };
/** A problem shown on a step: the message and, when known, the field to point at. */
type StepError = { step: number; message: string; field?: string };

/** A picture chosen in step 4, kept in the browser until the event exists. */
type Picture = { key: string; url: string; file: File };
const FOCUSABLE = "input:not([type=hidden]), select, textarea, button";
let nextId = 2;
let nextPicture = 1;

/** Moves focus to a field by its submitted name; for hidden inputs (date wheels, pickers) to the nearest visible control. */
function focusField(form: HTMLFormElement, name: string | undefined) {
  if (!name) return false;
  const found = form.elements.namedItem(name);
  const el = found instanceof RadioNodeList ? (found[0] as Element | undefined) : found;
  if (!(el instanceof HTMLElement)) return false;
  if (!(el instanceof HTMLInputElement && el.type === "hidden")) { el.focus(); return true; }
  for (let box = el.parentElement; box && box !== form; box = box.parentElement) {
    const control = box.querySelector<HTMLElement>(FOCUSABLE);
    if (control) { control.focus(); return true; }
  }
  return false;
}

// Create event (host area): one form in four steps (Basics, When & where, Tickets, Look & publish).
// Every step stays mounted (the others are `hidden`), so nothing is lost moving between them and the
// server action receives exactly the fields /events/new sent. Continue checks the step; Back never does.
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
  const s = useTranslations("createEvent.stepper");
  const root = useTranslations();
  const paidAvailable = paid.canSell && !!paid.currency;
  const paidCurrency = paid.currency ?? "NGN";
  const notPaid = sellReasonKey(paid.reason);
  const [feeChoice, setFeeChoice] = useState<FeeChoice>("host_absorbs");
  const [state, formAction, pending] = useActionState<CreateEventState, FormData>(createEvent, undefined);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<StepError | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headings = useRef<(HTMLHeadingElement | null)[]>([]);
  // Where focus goes after the step changes: the heading, or a field with a problem.
  const focusAfter = useRef<{ field?: string } | null>(null);
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState(defaultTheme);
  const [tiers, setTiers] = useState<Tier[]>([{ id: 1, name: t("form.tickets.defaultName"), price: "0", qty: "", desc: "", group: false, size: "4" }]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [isFree, setIsFree] = useState(true);
  const [online, setOnline] = useState(false);
  // The time zone follows the venue (TimeZoneField); LocationFields reports the country's zones and the venue's.
  const [zoneContext, setZoneContext] = useState<ZoneContext>({ countryName: "", countryZones: [], venueZone: null });
  // Up to five pictures (chunk 3c), held back from the Server Action and sent one by one, in order,
  // to the pictures route once the event exists (Cloudflare's WAF blocks some images sent to Server
  // Actions, src/lib/same-origin.ts). The first is the main picture.
  const [pictures, setPictures] = useState<Picture[]>([]);
  const pendingPictures = useRef<File[]>([]);
  const [sendingImage, setSendingImage] = useState(false);
  const router = useRouter();
  const [start, setStart] = useState({ date: "", time: "" });
  const [end, setEnd] = useState({ date: "", time: "" });
  const [whenAttempted, setWhenAttempted] = useState(false);

  useEffect(() => {
    const created = state?.created;
    if (!created) return;
    const files = pendingPictures.current;
    pendingPictures.current = [];
    setSendingImage(true);
    void (async () => {
      let ok = true;
      for (const file of files) {
        const url = URL.createObjectURL(file);
        const size = await measurePicture(url);
        URL.revokeObjectURL(url);
        if (!(await uploadPicture(created.id, file, size)).ok) { ok = false; break; }
      }
      router.push(ok ? created.next : `/host/events/${created.id}?tab=details&err=flyer_after_create`);
    })();
  }, [state, router]);

  // A refused submit: open the step holding the field the server named, and show its message there.
  useEffect(() => {
    if (!state?.error) return;
    const at = stepOfField(state.field);
    setError({ step: at, message: state.error, field: state.field });
    focusAfter.current = { field: state.field };
    setStep(at);
  }, [state]);

  // Previews are blob: URLs; let them go when the form goes.
  const previews = useRef(pictures);
  previews.current = pictures;
  useEffect(() => () => previews.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  // After a step change: focus the step's heading (or the field with a problem), so screen-reader
  // and keyboard users start at the top of the new step.
  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    if (target.field && formRef.current && focusField(formRef.current, target.field)) return;
    headings.current[step]?.focus();
  }, [step, error]);

  function go(to: number, field?: string) {
    focusAfter.current = { field };
    setStep(to);
  }

  /** The step's problem: the form's own checks (translated messages) first, then the browser's constraint validation. */
  function problemIn(at: number): StepError | null {
    const form = formRef.current;
    if (!form) return null;
    const problem = checkStep(at, new FormData(form));
    if (problem) return { step: at, message: root(problem.key, problem.values), field: problem.field };
    const section = form.querySelector<HTMLElement>(`[data-step="${at}"]`);
    const invalid = section ? Array.from(section.querySelectorAll<HTMLInputElement>("input, select, textarea")).find((el) => !el.checkValidity()) : undefined;
    return invalid ? { step: at, message: invalid.validationMessage, field: invalid.name || undefined } : null;
  }

  function onContinue() {
    if (step === 1) setWhenAttempted(true);
    const problem = problemIn(step);
    setError(problem);
    if (problem) {
      const form = formRef.current;
      if (form && !focusField(form, problem.field)) headings.current[step]?.focus();
      return;
    }
    go(nextStep(step));
  }

  function onBack() {
    setError(null);
    go(previousStep(step));
  }

  // Enter in a text field on steps 1–3 moves on rather than sending the form. Pickers that use Enter
  // themselves (venue search, country and zone lists) prevent the default first, so they're left alone.
  function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter" || e.nativeEvent.defaultPrevented || step === LAST_STEP) return;
    const target = e.target;
    if (target instanceof HTMLInputElement && !["submit", "button", "reset", "file"].includes(target.type)) {
      e.preventDefault();
      onContinue();
    }
  }

  function addPictures(files: File[]) {
    setPictures((list) => [...list, ...files.map((file) => ({ key: `p${nextPicture++}`, url: URL.createObjectURL(file), file }))]);
  }

  function removePicture(index: number) {
    setPictures((list) => {
      const gone = list[index];
      if (gone) URL.revokeObjectURL(gone.url);
      return list.filter((_, i) => i !== index);
    });
  }

  // The form is sent from here rather than by React's form action: after an action React clears
  // every field it doesn't manage, including the chosen image. Sending the FormData ourselves keeps
  // every field as typed. The `action` stays for submits before JavaScript loads.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < LAST_STEP) { onContinue(); return; }
    const form = e.currentTarget;
    // Every step was checked on Continue, but a field may have changed after going back: check them all again.
    for (let at = 0; at <= LAST_STEP; at++) {
      const problem = problemIn(at);
      if (problem) {
        if (at === 1) setWhenAttempted(true);
        setError(problem);
        go(at, problem.field);
        return;
      }
    }
    setError(null);
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(form, submitter instanceof HTMLButtonElement ? submitter : null);
    data.delete("flyer");
    pendingPictures.current = pictures.map((p) => p.file);
    if (pictures.length > 0) data.set("image_pending", "1");
    startTransition(() => formAction(data));
  }

  function updateTier<K extends keyof Omit<Tier, "id">>(id: number, key: K, value: Tier[K]) {
    setTiers((list) => list.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
  }

  const busy = pending || sendingImage;
  const stepName = (i: number) => s(STEPS[i]!);
  const stepError = (i: number) => (error && error.step === i ? <Banner tone="danger" title={error.message} /> : null);
  const heading = (i: number) => (
    <h2 id={`step-${i}-title`} className={styles.stepTitle} tabIndex={-1} ref={(el) => { headings.current[i] = el; }}>
      {stepName(i)}
    </h2>
  );

  return (
    <>
      <PageHeader title={s("title")} subtitle={s("stepOf", { step: step + 1, total: STEPS.length, name: stepName(step) })} />

      <ol className={styles.indicator} aria-label={s("progress")}>
        {STEPS.map((key, i) => {
          const done = i < step;
          const mark = <span className={styles.mark} aria-hidden>{done ? <Check size={16} strokeWidth={2} /> : i + 1}</span>;
          return (
            <li key={key} className={styles.indicatorItem} data-state={done ? "done" : i === step ? "current" : "todo"} aria-current={i === step ? "step" : undefined}>
              {canVisit(i, step) ? (
                <button type="button" className={styles.indicatorButton} onClick={() => { setError(null); go(i); }}>
                  {mark}<span>{stepName(i)}</span><span className={styles.visuallyHidden}>{s("completed")}</span>
                </button>
              ) : (
                <span className={styles.indicatorButton}>{mark}<span>{stepName(i)}</span></span>
              )}
            </li>
          );
        })}
      </ol>

      <form ref={formRef} action={formAction} className={styles.form} onSubmit={onSubmit} onKeyDown={onKeyDown} noValidate>
        {/* 1. Basics */}
        <section data-step={0} hidden={step !== 0} aria-labelledby="step-0-title" className={styles.step}>
          {heading(0)}
          {stepError(0)}
          <Card className={styles.card}>
            <Field label={t("form.eventName")} required>
              <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} minLength={3} maxLength={140} autoComplete="off" />
            </Field>
            <Field label={t("form.category")}>
              <Select name="category" defaultValue="Music">
                {CATEGORIES.map((c) => <option key={c} value={c}>{root(categoryLabelKey(c))}</option>)}
              </Select>
            </Field>
            <Field label={t("form.about")}>
              <Textarea name="description" rows={6} placeholder={t("form.aboutPlaceholder")} />
            </Field>
          </Card>
        </section>

        {/* 2. When & where */}
        <section data-step={1} hidden={step !== 1} aria-labelledby="step-1-title" className={styles.step}>
          {heading(1)}
          {stepError(1)}
          <Card as="section" className={styles.card}>
            <CardHeader title={t("form.when.label")} headingLevel={3} />
            <div className={styles.pair}>
              <div className={styles.group} role="group" aria-labelledby="when-start">
                <span className={styles.label} id="when-start">{t("form.when.starts")} <span aria-hidden>*</span></span>
                <DateTimeWheel label={t("form.when.start")} dateName="date" timeName="time" date={start.date} time={start.time}
                  invalid={whenAttempted} onChange={setStart} />
              </div>
              <div className={styles.group} role="group" aria-labelledby="when-end">
                <span className={styles.label} id="when-end">{t("form.when.ends")} <span aria-hidden>*</span></span>
                <DateTimeWheel label={t("form.when.end")} dateName="end_date" timeName="end_time" date={end.date} time={end.time}
                  invalid={whenAttempted} onChange={setEnd} />
              </div>
            </div>
            <TimeZoneField online={online} context={zoneContext} />
          </Card>

          <Card as="section" className={styles.card}>
            <CardHeader title={s("where")} headingLevel={3} />
            <div className={styles.option}>
              <div className={styles.optionText}>
                <span className={styles.label} id="opt-online">{t("online.title")}</span>
                <span className={styles.hint} id="opt-online-help">{t("online.help")}</span>
              </div>
              <Switch name="is_online" checked={online} onCheckedChange={setOnline} aria-labelledby="opt-online" aria-describedby="opt-online-help" />
            </div>
            {!online && <LocationFields detectedCountry={detectedCountry} placesEnabled={placesEnabled} onZoneContext={setZoneContext} />}
          </Card>
        </section>

        {/* 3. Tickets */}
        <section data-step={2} hidden={step !== 2} aria-labelledby="step-2-title" className={styles.step}>
          {heading(2)}
          {stepError(2)}
          <Card className={styles.card}>
            <fieldset className={styles.fieldset}>
              <legend className={styles.label}>{t("form.tickets.kind")}</legend>
              <div className={styles.segment}>
                <label className={styles.segmentOption}>
                  <input type="radio" name="ticket_kind" value="free" className={styles.visuallyHidden} checked={isFree}
                    onChange={() => { setIsFree(true); setTiers((list) => list.map((x) => ({ ...x, price: "0" }))); }} />
                  <span>{t("form.tickets.free")}</span>
                </label>
                {/* Paid needs Paystack on for the host's payout country, approval, and nothing owed (M5). */}
                <label className={styles.segmentOption} data-disabled={!paidAvailable || undefined}>
                  <input type="radio" name="ticket_kind" value="paid" className={styles.visuallyHidden} checked={!isFree} disabled={!paidAvailable}
                    aria-describedby={paidAvailable ? undefined : "paid-why"}
                    onChange={() => { setIsFree(false); setTiers((list) => list.map((x) => ({ ...x, price: x.price === "0" ? "" : x.price }))); }} />
                  <span>{t("form.tickets.paid")}</span>
                  {!paidAvailable && paid.reason === "payments_off" && <Badge plain>{t("form.tickets.comingSoon")}</Badge>}
                </label>
              </div>
            </fieldset>
            {!paidAvailable && (
              <p className={styles.hint} id="paid-why">
                {root(notPaid.key)}{" "}
                {notPaid.actionKey && <Link href="/host/payouts">{root(notPaid.actionKey)}</Link>}
              </p>
            )}
            {!isFree ? (
              <fieldset className={styles.fieldset}>
                <legend className={styles.label}>{t("form.tickets.whoPays")}</legend>
                <p className={styles.hint}>{t("form.tickets.pricesIn", { currency: paidCurrency })}</p>
                <div className={styles.segment}>
                  {(Object.keys(FEE_CHOICES) as FeeChoice[]).map((k) => (
                    <label key={k} className={styles.segmentOption}>
                      <input type="radio" name="fee_choice" value={k} className={styles.visuallyHidden} checked={feeChoice === k} onChange={() => setFeeChoice(k)} />
                      <span>{root(feeChoiceKey(k).labelKey)}</span>
                    </label>
                  ))}
                </div>
                <p className={styles.hint}>{root(feeChoiceKey(feeChoice).hintKey)}</p>
              </fieldset>
            ) : (
              <input type="hidden" name="fee_choice" value={feeChoice} />
            )}

            {tiers.map((tier) => (
              <div key={tier.id} className={styles.tier}>
                <div className={styles.pair}>
                  <Field label={t("form.tickets.name")}>
                    <Input name="tier_name" value={tier.name} maxLength={80} onChange={(e) => updateTier(tier.id, "name", e.target.value)} />
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
                <Field label={t("form.tickets.description")} hint={t("form.tickets.descriptionCount", { count: tier.desc.length, max: TICKET_DESCRIPTION_MAX })}>
                  <Textarea name="tier_desc" rows={2} maxLength={TICKET_DESCRIPTION_MAX} value={tier.desc} placeholder={t("form.tickets.descriptionPlaceholder")}
                    onChange={(e) => updateTier(tier.id, "desc", e.target.value)} />
                </Field>
                <div className={styles.option}>
                  <div className={styles.optionText}>
                    <span className={styles.label} id={`tier-group-${tier.id}`}>{t("form.tickets.group")}</span>
                    <span className={styles.hint} id={`tier-group-help-${tier.id}`}>{t("form.tickets.groupHelp")}</span>
                  </div>
                  <Switch checked={tier.group} onCheckedChange={(on) => updateTier(tier.id, "group", on)} aria-labelledby={`tier-group-${tier.id}`} aria-describedby={`tier-group-help-${tier.id}`} />
                </div>
                {tier.group ? (
                  <Field label={t("form.tickets.admits")} hint={t("form.tickets.admitsHint", { min: GROUP_MIN, max: GROUP_MAX })} className={styles.narrow}>
                    <Input name="tier_group_size" type="number" inputMode="numeric" min={GROUP_MIN} max={GROUP_MAX} step={1} required value={tier.size}
                      onChange={(e) => updateTier(tier.id, "size", e.target.value)} />
                  </Field>
                ) : (
                  <input type="hidden" name="tier_group_size" value="1" />
                )}
                {tiers.length > 1 && (
                  <Button variant="ghost" size="sm" className={styles.start} onClick={() => setTiers((x) => x.filter((y) => y.id !== tier.id))}>{t("form.tickets.remove")}</Button>
                )}
              </div>
            ))}
            <Button variant="secondary" className={styles.start} onClick={() => setTiers((x) => [...x, { id: nextId++, name: "", price: isFree ? "0" : "", qty: "", desc: "", group: false, size: "4" }])}>{t("form.tickets.add")}</Button>
            <Field label={t("form.tickets.perPerson")}>
              <Select name="per_buyer_limit" defaultValue="10">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
          </Card>
        </section>

        {/* 4. Look & publish */}
        <section data-step={3} hidden={step !== 3} aria-labelledby="step-3-title" className={styles.step}>
          {heading(3)}
          {stepError(3)}
          <Card as="section" className={styles.card}>
            <CardHeader title={s("look")} headingLevel={3} />
            <div className={styles.look}>
              <div className={styles.preview} style={{ background: themeBackground(theme) }} role="img" aria-label={s("preview", { title: title || t("form.coverTitle") })}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview (blob: URL) of the main picture */}
                {pictures[0] && <img className={styles.previewImage} src={pictures[0].url} alt="" />}
                <span className={styles.previewTitle}>{title || t("form.coverTitle")}</span>
              </div>
              <div className={styles.lookFields}>
                <PictureManager pictures={pictures} onAdd={addPictures} onRemove={removePicture}
                  onMove={(from, to) => setPictures((list) => movePicture(list, from, to))} busy={busy} />
              </div>
            </div>
            <fieldset className={styles.fieldset}>
              <legend className={styles.label}>{t("form.coverStyle")}</legend>
              <div className={styles.swatches}>
                {Object.entries(THEMES).map(([key, th]) => (
                  <label key={key} className={styles.swatch} style={{ background: th.background }}>
                    <input type="radio" name="cover_theme" value={key} className={styles.visuallyHidden} checked={theme === key} onChange={() => setTheme(key)} />
                    <span>{t.has(`themes.${key}`) ? t(`themes.${key}`) : th.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </Card>

          <Card as="section" className={styles.card}>
            <CardHeader title={t("form.options.label")} headingLevel={3} />
            <fieldset className={styles.fieldset}>
              <legend className={styles.label}>{t("form.options.visibility")}</legend>
              <span className={styles.hint}>{t("form.options.visibilityHelp")}</span>
              <div className={styles.segment}>
                {(["public", "private"] as const).map((v) => (
                  <label key={v} className={styles.segmentOption}>
                    <input type="radio" name="visibility" value={v} className={styles.visuallyHidden} checked={visibility === v} onChange={() => setVisibility(v)} />
                    <span>{t(`form.options.${v}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles.option}>
              <div className={styles.optionText}>
                <span className={styles.label} id="opt-approval">{t("form.options.approval")}</span>
                <span className={styles.hint} id="opt-approval-help">{t("form.options.approvalHelp")}</span>
              </div>
              <Switch name="require_approval" aria-labelledby="opt-approval" aria-describedby="opt-approval-help" />
            </div>

            <Field label={t("form.options.refundPolicy")} hint={isFree ? undefined : t("form.options.paidRefundNote")}>
              <Textarea name="refund_policy" rows={3} maxLength={2000} placeholder={t("form.options.refundPolicyPlaceholder")} />
            </Field>
          </Card>
        </section>

        <div className={styles.bar}>
          {step > 0 && <Button variant="ghost" onClick={onBack} disabled={busy}>{s("back")}</Button>}
          <span className={styles.spacer} />
          {step < LAST_STEP ? (
            <Button variant="primary" onClick={onContinue}>{s("continue")}</Button>
          ) : (
            <>
              <Button variant="secondary" type="submit" name="intent" value="draft" disabled={busy}>{t("form.saveDraft")}</Button>
              <Button variant="accent" type="submit" name="intent" value="publish" loading={busy}>
                {busy ? t("form.creating") : s("publishButton")}
              </Button>
            </>
          )}
        </div>
      </form>
    </>
  );
}
