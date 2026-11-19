"use client";

import { useTranslations } from "next-intl";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { useFormat } from "@/i18n/format-hooks";
import { PAYOUT_COUNTRIES, isPayoutCountry, type PayoutCountry } from "@/lib/payment-text";
import { applyToSell, changePayout, type FormState } from "./actions";
import BankAccountFields from "./BankAccountFields";
import { Button, Field, Input, Select } from "@/design";

const DOC_ACCEPT = "image/jpeg,image/png,application/pdf";
const DOC_MAX = 10 * 1024 * 1024;

/** HA1: who gets paid and where, with an ID or business document. */
export function HostApplicationForm({ countries, defaults }: { countries: PayoutCountry[]; defaults: { legalName: string; phone: string } }) {
  const t = useTranslations("account.payouts");
  const format = useFormat();
  const [state, action, pending] = useActionState<FormState, FormData>(applyToSell, undefined);
  const [country, setCountry] = useState<PayoutCountry | null>(countries.length === 1 ? countries[0]! : null);
  const [docError, setDocError] = useState("");
  const tAccount = useTranslations("account");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // The document goes to a route handler first and only its path to the Server Action: Cloudflare's
  // WAF blocks some files sent to Server Actions (src/lib/same-origin.ts). `action` stays for
  // submits before JavaScript loads.
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (docError) return;
    setUploadError("");
    const data = new FormData(e.currentTarget);
    const file = data.get("document");
    data.delete("document");
    if (file instanceof File && file.size > 0) {
      setUploading(true);
      const body = new FormData();
      body.set("document", file);
      const res = await fetch("/api/me/host-application/document", { method: "POST", body, headers: { Accept: "application/json" } }).catch(() => null);
      const reply = (await res?.json().catch(() => null)) as { path?: string; error?: string } | null;
      setUploading(false);
      if (!res?.ok || !reply?.path) {
        setUploadError(tAccount(reply?.error ?? "payouts.errors.uploadFailed"));
        return;
      }
      data.set("document_path", reply.path);
    }
    startTransition(() => action(data));
  }

  return (
    <form action={action} onSubmit={onSubmit} className="form stack" aria-describedby="apply-help">
      <p id="apply-help" className="muted small">
        {t("form.help")}
      </p>
      <Field label={t("form.legalName")}>
        <Input name="legal_name" defaultValue={defaults.legalName} minLength={2} maxLength={200} autoComplete="organization" required />
      </Field>
      <Field label={t("form.phone")}>
        <Input name="phone" type="tel" defaultValue={defaults.phone} autoComplete="tel" placeholder="+234 801 234 5678" required />
      </Field>
      <Field label={t("form.country")} hint={t("form.countryHint")}>
        <Select name="payout_country" value={country ?? ""} required
          onChange={(e) => setCountry(isPayoutCountry(e.target.value) ? e.target.value : null)}>
          <option value="" disabled>{t("form.chooseCountry")}</option>
          {countries.map((c) => <option key={c} value={c}>{t("form.countryOption", { country: format.country(c), currency: PAYOUT_COUNTRIES[c].currency })}</option>)}
        </Select>
      </Field>

      <BankAccountFields country={country} />

      <Field label={t("form.document")} hint={t("form.documentHint")} error={docError || undefined}>
        <Input type="file" name="document" accept={DOC_ACCEPT} required
          onChange={(e) => {
            const f = e.target.files?.[0];
            setDocError(f && f.size > DOC_MAX ? t("input.documentTooLarge") : "");
          }} />
      </Field>

      {uploadError && <p className="error" role="alert">{uploadError}</p>}
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <Button variant="accent" type="submit" disabled={pending || uploading || !!docError}>{pending || uploading ? t("form.sending") : t("form.send")}</Button>
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
      <Button variant="primary" type="submit" disabled={pending}>{pending ? t("saving") : t("change")}</Button>
    </form>
  );
}
