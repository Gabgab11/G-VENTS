"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    return <p className="pay-hold" role="timer" aria-live="off">Your tickets are held for <b>{left(deadline - now)}</b>.</p>;
  }
  if (watching) return <p className="muted small" aria-live="polite">Checking your payment with Paystack...</p>;
  return (
    <p className="muted small">
      Still no answer from Paystack. <button type="button" className="link-btn gold" onClick={() => router.refresh()}>Check again</button>
    </p>
  );
}

/** "Pay with Paystack" for an order the API says can be paid now (canPay). */
export function PayButton({ orderId, label }: { orderId: string; label: string }) {
  const [state, action, pending] = useActionState<PayState, FormData>(payOrder, undefined);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="order_id" value={orderId} />
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn-white pay-cta" type="submit" disabled={pending}>{pending ? "Opening Paystack..." : label}</button>
    </form>
  );
}
