"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { wholeUnitsToMinor } from "@/lib/money";
import { useFormat } from "@/i18n/format-hooks";
import { previewFee, type FeePreview } from "@/app/(site)/events/actions";
import type { FeeChoice } from "@/lib/payment-text";

// The live example under a paid price (M5 TicketTypeEditor): what a guest pays for one ticket and
// what the host receives, from the API's fee preview (fee, VAT and Paystack's charge for their country).
export default function FeeExample({ price, currency, feeChoice }: { price: string; currency: string; feeChoice: FeeChoice }) {
  const t = useTranslations("createEvent.fee");
  const format = useFormat();
  const minor = wholeUnitsToMinor(price, currency);
  const [preview, setPreview] = useState<FeePreview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    if (!minor) { setPreview(null); return; }
    let live = true;
    const timer = setTimeout(() => {
      previewFee(minor, feeChoice).then((res) => {
        if (!live) return;
        if ("error" in res) { setPreview(null); setError(res.error); }
        else setPreview(res);
      });
    }, 350);
    return () => { live = false; clearTimeout(timer); };
  }, [minor, feeChoice]);

  if (price.trim() !== "" && minor === null) return <p className="error small" role="alert">{t("wholeNumber")}</p>;
  if (!minor) return null;
  if (error) return <p className="muted small">{error}</p>;
  if (!preview) return <p className="muted small" aria-live="polite">{t("working")}</p>;
  const money = (minorUnits: number) => format.money(minorUnits, preview.currency);
  const amounts = { fee: money(preview.feeMinor), charge: money(preview.providerChargeMinor) };
  return (
    <p className="fee-example small" aria-live="polite">
      {t.rich("summary", { guest: money(preview.guestPaysMinor), host: money(preview.hostReceivesMinor), b: (c) => <b>{c}</b> })}
      <span className="muted">{" "}{preview.vatMinor > 0 ? t("breakdownVat", { ...amounts, vat: money(preview.vatMinor) }) : t("breakdown", amounts)}</span>
    </p>
  );
}
