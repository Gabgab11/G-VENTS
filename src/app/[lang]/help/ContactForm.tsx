"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Banner, Button, Field, Input, Select, Textarea } from "@/design";
import Turnstile, { type TurnstileHandle } from "@/components/Turnstile";
import { env } from "@/lib/env";
import { CONTACT_LIMITS, CONTACT_TOPICS, messageLength, validateContact, type ContactField } from "@/lib/contact";
import { contactPrefill, sendSupportMessage } from "./actions";
import styles from "./help.module.css";

const EMPTY = { name: "", email: "", country: "NG", topic: "", message: "", website: "" };

// The contact form (Change 4 follow-up, step 4), laid out like Mirage's contact page: name and email,
// country and topic, the message with a counter, a hidden honeypot and Turnstile when it's on.
// Signed-in visitors get their name, email and country filled in (the page itself stays cached).
/** `countries` come from the server (contactCountryOptions), so the browser's own country names can't differ from the page's. */
export default function ContactForm({ countries }: { countries: { value: string; label: string }[] }) {
  const t = useTranslations("info.help.contact");
  const locale = useLocale();
  const id = useId();
  const [form, setForm] = useState(EMPTY);
  const touched = useRef(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [pending, startTransition] = useTransition();
  const siteKey = env.turnstileSiteKey;
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);

  useEffect(() => {
    let live = true;
    contactPrefill()
      .then((me) => {
        if (!live || !me) return;
        setForm((f) => (touched.current ? f : { ...f, name: f.name || me.name, email: f.email || me.email, country: me.country ?? f.country }));
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

  const set = (patch: Partial<typeof EMPTY>) => {
    touched.current = true;
    setForm((f) => ({ ...f, ...patch }));
    setFieldErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as ContactField];
      return next;
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const checked = validateContact(form);
    if (!checked.ok) {
      setFieldErrors(Object.fromEntries(Object.entries(checked.errors).map(([f, code]) => [f, t(`errors.${code}`)])));
      setError(t("errors.fix"));
      return;
    }
    if (siteKey && !captchaToken) {
      setError(t("errors.captchaWait"));
      return;
    }
    startTransition(async () => {
      const result = await sendSupportMessage({ ...form, captchaToken: siteKey ? captchaToken : null, language: locale }).catch(() => ({ ok: false as const, error: t("errors.failed") }));
      // Each token works once: get a fresh one for the next try.
      captcha.current?.reset();
      if (result.ok) {
        setSent(true);
        setForm((f) => ({ ...EMPTY, name: f.name, email: f.email, country: f.country }));
        return;
      }
      setError(result.error);
      setFieldErrors("fields" in result && result.fields ? result.fields : {});
    });
  };

  if (sent) {
    return (
      <div className={styles.success} role="status">
        <span className={styles.successIcon} aria-hidden><Check size={20} strokeWidth={2.25} /></span>
        <div className={styles.successText}>
          <strong>{t("sent.title")}</strong>
          <p>{t("sent.text")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setSent(false)}>{t("sent.again")}</Button>
      </div>
    );
  }

  const length = messageLength(form.message);
  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-describedby={error ? `${id}-error` : undefined}>
      {error && <Banner tone="danger" title={error} id={`${id}-error`} />}
      <div className={styles.fieldRow}>
        <Field label={t("name")} error={fieldErrors.name} required>
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={CONTACT_LIMITS.name.max} autoComplete="name" placeholder={t("namePlaceholder")} />
        </Field>
        <Field label={t("email")} error={fieldErrors.email} required>
          <Input value={form.email} onChange={(e) => set({ email: e.target.value })} type="email" inputMode="email" dir="ltr" maxLength={CONTACT_LIMITS.email} autoComplete="email" placeholder={t("emailPlaceholder")} />
        </Field>
      </div>
      <div className={styles.fieldRow}>
        <Field label={t("country")} error={fieldErrors.country} required>
          <Select value={form.country} onChange={(e) => set({ country: e.target.value })} autoComplete="country">
            <option value="" disabled>{t("countryPlaceholder")}</option>
            {countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Field>
        <Field label={t("topic")} error={fieldErrors.topic} required>
          <Select value={form.topic} onChange={(e) => set({ topic: e.target.value })}>
            <option value="" disabled>{t("topicPlaceholder")}</option>
            {CONTACT_TOPICS.map((topic) => <option key={topic} value={topic}>{t(`topics.${topic}`)}</option>)}
          </Select>
        </Field>
      </div>
      <Field
        label={t("message")}
        error={fieldErrors.message}
        hint={<span className={styles.counter}>{t("counter", { count: length, max: CONTACT_LIMITS.message.max })}</span>}
        required
      >
        <Textarea value={form.message} onChange={(e) => set({ message: e.target.value })} rows={7} maxLength={CONTACT_LIMITS.message.max + 200} placeholder={t("messagePlaceholder")} />
      </Field>
      {/* The honeypot: hidden from people and screen readers; bots fill it and the API drops the message. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label htmlFor={`${id}-website`}>{"Website"}</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
      </div>
      {siteKey && <Turnstile ref={captcha} siteKey={siteKey} onToken={setCaptchaToken} onError={() => setError(t("errors.captchaLoad"))} />}
      <div className={styles.formFooter}>
        <p>{t("consent")}</p>
        <Button type="submit" variant="primary" loading={pending}>{pending ? t("sending") : t("send")}</Button>
      </div>
    </form>
  );
}
