"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useFormat } from "@/i18n/format-hooks";
import { PAYOUT_COUNTRIES, isPayoutCountry, type PayoutCountry } from "@/lib/payment-text";
import { applyToSell, changePayout, type FormState } from "./actions";
import BankAccountFields from "./BankAccountFields";

const DOC_ACCEPT = "image/jpeg,image/png,application/pdf";
const DOC_MAX = 10 * 1024 * 1024;

/** HA1: who gets paid and where, with an ID or business document. */
export function HostApplicationForm({ countries, defaults }: { countries: PayoutCountry[]; defaults: { legalName: string; phone: string } }) {
  const t = useTranslations("account.payouts");
  const format = useFormat();
  const [state, action, pending] = useActionState<FormState, FormData>(applyToSell, undefined);
  const [country, setCountry] = useState<PayoutCountry | null>(countries.length === 1 ? countries[0]! : null);
  const [docError, setDocError] = useState("");

  return (
    <form action={action} className="form stack" aria-describedby="apply-help">
      <p id="apply-help" className="muted small">
        {t("form.help")}
      </p>
      <label className="field"><span>{t("form.legalName")}</span>
        <input className="input" name="legal_name" defaultValue={defaults.legalName} minLength={2} maxLength={200} autoComplete="organization" required /></label>
      <label className="field"><span>{t("form.phone")}</span>
        <input className="input" name="phone" type="tel" defaultValue={defaults.phone} autoComplete="tel" placeholder="+234 801 234 5678" required /></label>
      <label className="field"><span>{t("form.country")}</span>
        <select className="input" name="payout_country" value={country ?? ""} required
          onChange={(e) => setCountry(isPayoutCountry(e.target.value) ? e.target.value : null)} aria-describedby="country-hint">
          <option value="" disabled>{t("form.chooseCountry")}</option>
          {countries.map((c) => <option key={c} value={c}>{t("form.countryOption", { country: format.country(c), currency: PAYOUT_COUNTRIES[c].currency })}</option>)}
        </select>
        <small id="country-hint" className="muted">{t("form.countryHint")}</small></label>

      <BankAccountFields country={country} />

      <label className="field"><span>{t("form.document")}</span>
        <input className="input" type="file" name="document" accept={DOC_ACCEPT} required aria-describedby="doc-hint"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setDocError(f && f.size > DOC_MAX ? t("input.documentTooLarge") : "");
          }} />
        <small id="doc-hint" className="muted">{t("form.documentHint")}</small></label>
      {docError && <p className="error" role="alert">{docError}</p>}

      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn-grad" type="submit" disabled={pending || !!docError}>{pending ? t("form.sending") : t("form.send")}</button>
    </form>
  );
}

/** HA4: new payout details; two-step sign-in, and paid sales pause until staff confirm them. */
export function PayoutChangeForm({ country }: { country: PayoutCountry }) {
  const t = useTranslations("account.payouts.form");
  const [state, action, pending] = useActionState<FormState, FormData>(changePayout, undefined);
  return (
    <form action={action} className="form stack">
      <p className="muted small">
        {t("changeNote")}
      </p>
      <BankAccountFields country={country} />
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn-white" type="submit" disabled={pending}>{pending ? t("saving") : t("change")}</button>
    </form>
  );
}
