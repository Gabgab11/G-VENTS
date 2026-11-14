"use client";

import { useEffect, useState } from "react";
import { formatMinor, wholeUnitsToMinor } from "@/lib/money";
import { previewFee, type FeePreview } from "@/app/events/actions";
import type { FeeChoice } from "@/lib/payment-text";

// The live example under a paid price (M5 TicketTypeEditor): what a guest pays for one ticket and
// what the host receives, from the API's fee preview (fee, VAT and Paystack's charge for their country).
export default function FeeExample({ price, currency, feeChoice }: { price: string; currency: string; feeChoice: FeeChoice }) {
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

  if (price.trim() !== "" && minor === null) return <p className="error small" role="alert">Use a whole number, like 5000.</p>;
  if (!minor) return null;
  if (error) return <p className="muted small">{error}</p>;
  if (!preview) return <p className="muted small" aria-live="polite">Working out the fees...</p>;
  return (
    <p className="fee-example small" aria-live="polite">
      Guest pays <b>{formatMinor(preview.guestPaysMinor, preview.currency)}</b> · you receive <b>{formatMinor(preview.hostReceivesMinor, preview.currency)}</b>
      <span className="muted"> (G-ventZ fee {formatMinor(preview.feeMinor, preview.currency)}
        {preview.vatMinor > 0 ? ` + VAT ${formatMinor(preview.vatMinor, preview.currency)}` : ""}
        {" "}+ Paystack about {formatMinor(preview.providerChargeMinor, preview.currency)})</span>
    </p>
  );
}
