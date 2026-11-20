"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design";
import { payOrder, type PayState } from "./actions";

const POLL_MS = 3_000;
/** Keep checking a little after the hold ends: the API re-verifies late payments (CK8). */
const GRACE_MS = 5 * 60_000;

function left(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * While a payment isn't final, refreshes the page from the API every few seconds (the status comes
 * from Paystack's webhook and the API's own check, never from the return link) and counts down
 * the hold. Stops by itself once the status is final, since the page then renders without it.
 */
export function PaymentWatcher({ holdExpiresAt }: { holdExpiresAt: string | null }) {
  const t = useTranslations("tickets.payment");
  const router = useRouter();
  const deadline = holdExpiresAt ? Date.parse(holdExpiresAt) : null;
  const [now, setNow] = useState(() => Date.now());
  const watching = deadline === null || now < deadline + GRACE_MS;

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!watching) return;
    const poll = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(poll);
  }, [router, watching]);

  if (deadline !== null && now < deadline) {
    return <p className="pay-hold" role="timer" aria-live="off">{t.rich("held", { b: (c) => <b>{c}</b>, time: left(deadline - now) })}</p>;
  }
  if (watching) return <p className="muted small" aria-live="polite">{t("checking")}</p>;
  return (
    <p className="muted small">
      {t.rich("noAnswer", { button: (c) => <button type="button" className="link-btn gold" onClick={() => router.refresh()}>{c}</button> })}
    </p>
  );
}

/** "Pay with Paystack" for an order the API says can be paid now (canPay). */
export function PayButton({ orderId, label }: { orderId: string; label: string }) {
  const t = useTranslations("tickets.payment");
  const [state, action, pending] = useActionState<PayState, FormData>(payOrder, undefined);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="order_id" value={orderId} />
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <Button variant="primary" className="pay-cta" type="submit" disabled={pending}>{pending ? t("opening") : label}</Button>
    </form>
  );
}
