"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import type { PayoutCountry } from "@/lib/payment-text";
import { checkAccount, loadBanks } from "./actions";

type Bank = { code: string; name: string };
type Resolved = { verified: boolean; accountName: string | null };

// Bank, account number and Paystack's account-name check (HA1). The resolved name is shown back
// so the host confirms it's theirs; the confirm box appears only after a check of these details.
export default function BankAccountFields({ country }: { country: PayoutCountry | null }) {
  const t = useTranslations("account.payouts.bank");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankError, setBankError] = useState("");
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [number, setNumber] = useState("");
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [checkError, setCheckError] = useState("");
  const [checking, startCheck] = useTransition();

  useEffect(() => {
    setBanks([]);
    setBankCode("");
    setResolved(null);
    setBankError("");
    if (!country) return;
    let live = true;
    setLoadingBanks(true);
    loadBanks(country).then((res) => {
      if (!live) return;
      setLoadingBanks(false);
      if ("error" in res) setBankError(res.error);
      else setBanks(res.banks);
    });
    return () => { live = false; };
  }, [country]);

  function check() {
    setCheckError("");
    setResolved(null);
    if (!country) return;
    startCheck(async () => {
      const res = await checkAccount(country, bankCode, number);
      if ("error" in res) setCheckError(res.error);
      else setResolved({ verified: res.verified, accountName: res.accountName });
    });
  }

  const bankName = banks.find((b) => b.code === bankCode)?.name ?? "";

  return (
    <div className="stack">
      <label className="field"><span>{t("bank")}</span>
        <select className="input" name="bank_code" value={bankCode} required disabled={!country || loadingBanks}
          onChange={(e) => { setBankCode(e.target.value); setResolved(null); }}>
          <option value="" disabled>{!country ? t("chooseCountryFirst") : loadingBanks ? t("loadingBanks") : t("chooseBank")}</option>
          {banks.map((b) => <option key={`${b.code}-${b.name}`} value={b.code}>{b.name}</option>)}
        </select></label>
      <input type="hidden" name="bank_name" value={bankName} />
      {bankError && <p className="error" role="alert">{bankError}</p>}

      <label className="field"><span>{t("accountNumber")}</span>
        <input className="input" name="account_number" inputMode="numeric" autoComplete="off" maxLength={24} required value={number}
          onChange={(e) => { setNumber(e.target.value); setResolved(null); }} /></label>

      <div className="row-gap">
        <button type="button" className="btn-ghost" onClick={check} disabled={checking || !bankCode || number.trim().length < 6}>
          {checking ? t("checking") : t("check")}
        </button>
      </div>
      {checkError && <p className="error" role="alert">{checkError}</p>}

      {resolved && (
        <div className="pay-resolved" role="status">
          {resolved.verified && resolved.accountName ? (
            <p>{t.rich("accountName", { name: resolved.accountName, b: (c) => <b>{c}</b> })}</p>
          ) : (
            <p className="muted small">{t("cantCheck")}</p>
          )}
          <label className="check">
            <input type="checkbox" name="confirm_account" required />
            <span>{resolved.verified && resolved.accountName ? t("confirmNamed", { name: resolved.accountName }) : t("confirm")}</span>
          </label>
        </div>
      )}
    </div>
  );
}
