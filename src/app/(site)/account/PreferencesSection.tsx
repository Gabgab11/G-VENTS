"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Card, CardHeader } from "@/design";
import { Switch, useToast } from "@/design/client";
import { setLanguage } from "@/i18n/actions";
import type { Locale } from "@/i18n/languages";
import { EMAIL_PREFERENCES, type EmailPreference, type EmailPreferences } from "./account-input";
import { setEmailPreference } from "./actions";
import s from "./account.module.css";

// Preferences (FR-35): the language (the same setting as Settings → Language and the footer menu:
// saved to the profile and a cookie, and the page reloads in it) and the three email switches,
// each saved as soon as it's flipped.

function LanguagePicker({ current, options }: { current: Locale; options: { code: Locale; name: string }[] }) {
  const t = useTranslations("account.page.preferences");
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (code: Locale) => {
    if (code === current) return;
    start(async () => {
      await setLanguage(code, "/account");
      router.refresh();
    });
  };
  return (
    <div role="group" aria-labelledby="account-language" aria-busy={pending || undefined} className={s.languages}>
      {options.map((o) => (
        <button key={o.code} type="button" lang={o.code} className={s.language} aria-pressed={o.code === current} onClick={() => choose(o.code)} disabled={pending}>
          <span>{o.name}</span>
          {o.code === current && <Check size={16} strokeWidth={1.75} aria-hidden className={s.check} />}
        </button>
      ))}
      <span className="sr-only" aria-live="polite">{pending ? t("languageSaving") : ""}</span>
    </div>
  );
}

function EmailSwitches({ initial }: { initial: EmailPreferences }) {
  const t = useTranslations("account.page.preferences");
  const { toast } = useToast();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState<EmailPreference | null>(null);

  const flip = async (key: EmailPreference, on: boolean) => {
    setBusy(key);
    setValues((v) => ({ ...v, [key]: on }));
    const result = await setEmailPreference(key, on).catch(() => ({ ok: false as const, message: t("failed") }));
    setBusy(null);
    if (result.ok) toast({ title: on ? t("on", { what: t(`email.${key}.title`) }) : t("off", { what: t(`email.${key}.title`) }), tone: "success" });
    else {
      setValues((v) => ({ ...v, [key]: !on }));
      toast({ title: result.message, tone: "danger" });
    }
  };

  return (
    <ul className={s.switches}>
      {EMAIL_PREFERENCES.map((key) => (
        <li key={key} className={s.switchRow}>
          <span className={s.switchText}>
            <span id={`pref-${key}`} className={s.label}>{t(`email.${key}.title`)}</span>
            <span id={`pref-${key}-hint`} className={s.hint}>{t(`email.${key}.hint`)}</span>
          </span>
          <Switch
            checked={values[key]}
            onCheckedChange={(on) => void flip(key, on)}
            disabled={busy === key}
            aria-labelledby={`pref-${key}`}
            aria-describedby={`pref-${key}-hint`}
          />
        </li>
      ))}
    </ul>
  );
}

export default function PreferencesSection({ language, options, email }: { language: Locale; options: { code: Locale; name: string }[]; email: EmailPreferences }) {
  const t = useTranslations("account.page.preferences");
  return (
    <Card as="section" aria-labelledby="account-preferences" className={s.section}>
      <CardHeader title={<span id="account-preferences">{t("title")}</span>} />
      <div className={s.group}>
        <h3 id="account-language" className={s.subheading}>{t("language")}</h3>
        <p className={s.hint}>{t("languageHint")}</p>
        <LanguagePicker current={language} options={options} />
      </div>
      <div className={s.group}>
        <h3 className={s.subheading}>{t("emailTitle")}</h3>
        <p className={s.hint}>{t("emailHint")}</p>
        <EmailSwitches initial={email} />
      </div>
    </Card>
  );
}
