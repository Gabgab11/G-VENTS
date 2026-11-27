"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { Button, Field, Select } from "@/design";
import { PROVIDER_NAMES, type PayoutCountry, type ProviderId } from "@/lib/payment-text";
import { chooseSubaccountBank, loadBanks, type FormState } from "./actions";

type Bank = { code: string; name: string };

/**
 * PS12: the provider couldn't match the host's bank (needs_host). The host picks it from that
 * provider's own list; the account number stays the same, and the API checks the name with it.
 */
export default function SubaccountBankForm({ provider, country }: { provider: ProviderId; country: PayoutCountry }) {
  const t = useTranslations("account.payouts.providers");
  const tb = useTranslations("account.payouts.bank");
  const [state, action, pending] = useActionState<FormState, FormData>(chooseSubaccountBank, undefined);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [bankCode, setBankCode] = useState("");
  const name = PROVIDER_NAMES[provider];

  useEffect(() => {
    let live = true;
    loadBanks(country, provider).then((res) => {
      if (!live) return;
      setLoading(false);
      if ("error" in res) setLoadError(res.error);
      else setBanks(res.banks);
    });
    return () => { live = false; };
  }, [country, provider]);

  return (
    <form action={action} className="form stack">
      <input type="hidden" name="provider" value={provider} />
      <p className="muted small">{t("needsHostNote", { provider: name })}</p>
      <Field label={t("chooseBank", { provider: name })} error={loadError || undefined}>
        <Select name="bank_code" value={bankCode} required disabled={loading || !!loadError} onChange={(e) => setBankCode(e.target.value)}>
          <option value="" disabled>{loading ? tb("loadingBanks") : tb("chooseBank")}</option>
          {banks.map((b) => <option key={`${b.code}-${b.name}`} value={b.code}>{b.name}</option>)}
        </Select>
      </Field>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <div>
        <Button variant="primary" type="submit" loading={pending} disabled={pending || !bankCode}>{pending ? t("saving") : t("save")}</Button>
      </div>
    </form>
  );
}
