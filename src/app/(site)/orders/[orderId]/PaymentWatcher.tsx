"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design";
import { payOrder, type PayState } from "./actions";
import { pollDelay, watchUntil } from "./polling";

function left(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * While a payment isn't final, refreshes the page from the API (the status comes from the
 * provider's webhook and the API's own check, never from the return link) and counts down the hold.
 * Checks every 3 seconds at first, then less often, until 30 minutes after the hold: bank transfers
 * can take minutes (polling.ts). Stops by itself once the status is final, since the page then
 * renders without it.
 */
export function PaymentWatcher({ holdExpiresAt, provider }: { holdExpiresAt: string | null; provider: string }) {
  const t = useTranslations("tickets.payment");
  const router = useRouter();
  const deadline = holdExpiresAt ? Date.parse(holdExpiresAt) : null;
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const until = watchUntil(deadline, startedAt);
  const watching = now < until;
  const elapsed = now - startedAt;
  const delay = pollDelay(elapsed);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!watching) return;
    const poll = setInterval(() => router.refresh(), delay);
    return () => clearInterval(poll);
  }, [router, watching, delay]);

  if (deadline !== null && now < deadline) {
    return <p className="pay-hold" role="timer" aria-live="off">{t.rich("held", { b: (c) => <b>{c}</b>, time: left(deadline - now) })}</p>;
  }
  if (watching) {
    return (
      <div aria-live="polite">
        <p className="muted small">{t("checking", { provider })}</p>
        <p className="muted small">{t("slowNote")}</p>
      </div>
    );
  }
  return (
    <p className="muted small">
      {t.rich("noAnswer", { provider, button: (c) => <button type="button" className="link-btn gold" onClick={() => router.refresh()}>{c}</button> })}
    </p>
  );
}

/** "Pay with {provider}" for an order the API says can be paid now (canPay). */
export function PayButton({ orderId, label, provider }: { orderId: string; label: string; provider: string }) {
  const t = useTranslations("tickets.payment");
  const [state, action, pending] = useActionState<PayState, FormData>(payOrder, undefined);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="order_id" value={orderId} />
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <Button variant="primary" className="pay-cta" type="submit" disabled={pending}>{pending ? t("opening", { provider }) : label}</Button>
    </form>
  );
}
