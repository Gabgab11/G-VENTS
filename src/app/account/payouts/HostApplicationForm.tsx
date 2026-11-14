"use client";

import { useActionState, useState } from "react";
import { PAYOUT_COUNTRIES, isPayoutCountry, type PayoutCountry } from "@/lib/payment-text";
import { applyToSell, changePayout, type FormState } from "./actions";
import BankAccountFields from "./BankAccountFields";

const DOC_ACCEPT = "image/jpeg,image/png,application/pdf";
const DOC_MAX = 10 * 1024 * 1024;

/** HA1: who gets paid and where, with an ID or business document. */
export function HostApplicationForm({ countries, defaults }: { countries: PayoutCountry[]; defaults: { legalName: string; phone: string } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(applyToSell, undefined);
  const [country, setCountry] = useState<PayoutCountry | null>(countries.length === 1 ? countries[0]! : null);
  const [docError, setDocError] = useState("");

  return (
    <form action={action} className="form stack" aria-describedby="apply-help">
      <p id="apply-help" className="muted small">
        We use these details to pay you through Paystack. A person at G-ventZ checks each application, usually within two working days.
      </p>
      <label className="field"><span>Legal or business name</span>
        <input className="input" name="legal_name" defaultValue={defaults.legalName} minLength={2} maxLength={200} autoComplete="organization" required /></label>
      <label className="field"><span>Phone number</span>
        <input className="input" name="phone" type="tel" defaultValue={defaults.phone} autoComplete="tel" placeholder="+234 801 234 5678" required /></label>
      <label className="field"><span>Country you get paid in</span>
        <select className="input" name="payout_country" value={country ?? ""} required
          onChange={(e) => setCountry(isPayoutCountry(e.target.value) ? e.target.value : null)} aria-describedby="country-hint">
          <option value="" disabled>Choose a country</option>
          {countries.map((c) => <option key={c} value={c}>{PAYOUT_COUNTRIES[c].name} ({PAYOUT_COUNTRIES[c].currency})</option>)}
        </select>
        <small id="country-hint" className="muted">You sell paid tickets in this country&apos;s currency only.</small></label>

      <BankAccountFields country={country} />

      <label className="field"><span>Government ID or business registration</span>
        <input className="input" type="file" name="document" accept={DOC_ACCEPT} required aria-describedby="doc-hint"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setDocError(f && f.size > DOC_MAX ? "The document is larger than 10 MB. Please use a smaller file." : "");
          }} />
        <small id="doc-hint" className="muted">JPG, PNG or PDF, up to 10 MB. Only G-ventZ staff can see it.</small></label>
      {docError && <p className="error" role="alert">{docError}</p>}

      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn-grad" type="submit" disabled={pending || !!docError}>{pending ? "Sending..." : "Send application"}</button>
    </form>
  );
}

/** HA4: new payout details; two-step sign-in, and paid sales pause until staff confirm them. */
export function PayoutChangeForm({ country }: { country: PayoutCountry }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePayout, undefined);
  return (
    <form action={action} className="form stack">
      <p className="muted small">
        For your safety you&apos;ll confirm it&apos;s you with two-step sign-in. Paid sales pause until G-ventZ confirms the new account, and we email you about the change.
      </p>
      <BankAccountFields country={country} />
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn-white" type="submit" disabled={pending}>{pending ? "Saving..." : "Change payout details"}</button>
    </form>
  );
}
