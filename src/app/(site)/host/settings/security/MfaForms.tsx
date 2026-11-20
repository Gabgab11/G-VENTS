"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { Button, Field, Input } from "@/design";
import { finishEnroll, startEnroll, verifyCode, type EnrollState, type VerifyState } from "./actions";

function CodeField() {
  const t = useTranslations("account.mfa");
  return (
    <Field label={t("codeLabel")}>
      <Input className="mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus />
    </Field>
  );
}

/** Set up an authenticator app: QR code (or the secret), then the first code to confirm it. */
export function EnrollForm({ next }: { next: string }) {
  const t = useTranslations("account.mfa");
  const [setup, setSetup] = useState<EnrollState>(undefined);
  const [starting, start] = useTransition();
  const [state, confirm, confirming] = useActionState<EnrollState, FormData>(finishEnroll, undefined);
  const current = state?.factorId ? state : setup;

  if (!current?.factorId) {
    return (
      <div className="stack">
        {setup?.error && <p className="error" role="alert">{setup.error}</p>}
        <Button variant="accent" disabled={starting} onClick={() => start(async () => setSetup(await startEnroll()))}>
          {starting ? t("preparing") : t("setUp")}
        </Button>
      </div>
    );
  }
  return (
    <form action={confirm} className="stack mfa-enroll">
      <ol className="mfa-steps">
        <li>{t("step1")}</li>
        <li>{t("step2")}</li>
        <li>{t("step3")}</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns the QR code as an SVG data URL */}
      {current.qr && <img className="mfa-qr" src={current.qr} alt={t("qrAlt")} width={180} height={180} />}
      <p className="muted small">{t.rich("key", { secret: current.secret ?? "", code: (c) => <code className="mfa-secret">{c}</code> })}</p>
      <input type="hidden" name="factor_id" value={current.factorId} />
      <input type="hidden" name="qr" value={current.qr ?? ""} />
      <input type="hidden" name="secret" value={current.secret ?? ""} />
      <input type="hidden" name="next" value={next} />
      <CodeField />
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <Button variant="accent" type="submit" disabled={confirming}>{confirming ? t("checking") : t("turnOn")}</Button>
    </form>
  );
}

/** Confirm this session with the authenticator app (needed for staff pages). */
export function VerifyForm({ next }: { next: string }) {
  const t = useTranslations("account.mfa");
  const [state, verify, pending] = useActionState<VerifyState, FormData>(verifyCode, undefined);
  return (
    <form action={verify} className="stack">
      <input type="hidden" name="next" value={next} />
      <CodeField />
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <Button variant="accent" type="submit" disabled={pending}>{pending ? t("checking") : t("continue")}</Button>
    </form>
  );
}
