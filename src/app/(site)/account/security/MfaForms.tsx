"use client";

import { useActionState, useState, useTransition } from "react";
import { finishEnroll, startEnroll, verifyCode, type EnrollState, type VerifyState } from "./actions";

function CodeField() {
  return (
    <label className="field"><span>6-digit code</span>
      <input className="input mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus />
    </label>
  );
}

/** Set up an authenticator app: QR code (or the secret), then the first code to confirm it. */
export function EnrollForm({ next }: { next: string }) {
  const [setup, setSetup] = useState<EnrollState>(undefined);
  const [starting, start] = useTransition();
  const [state, confirm, confirming] = useActionState<EnrollState, FormData>(finishEnroll, undefined);
  const current = state?.factorId ? state : setup;

  if (!current?.factorId) {
    return (
      <div className="stack">
        {setup?.error && <p className="error" role="alert">{setup.error}</p>}
        <button type="button" className="btn-grad" disabled={starting} onClick={() => start(async () => setSetup(await startEnroll()))}>
          {starting ? "Preparing…" : "Set up an authenticator app"}
        </button>
      </div>
    );
  }
  return (
    <form action={confirm} className="stack mfa-enroll">
      <ol className="mfa-steps">
        <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).</li>
        <li>Scan this QR code, or type the key below.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns the QR code as an SVG data URL */}
      {current.qr && <img className="mfa-qr" src={current.qr} alt="QR code for your authenticator app" width={180} height={180} />}
      <p className="muted small">Key: <code className="mfa-secret">{current.secret}</code></p>
      <input type="hidden" name="factor_id" value={current.factorId} />
      <input type="hidden" name="qr" value={current.qr ?? ""} />
      <input type="hidden" name="secret" value={current.secret ?? ""} />
      <input type="hidden" name="next" value={next} />
      <CodeField />
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button type="submit" className="btn-grad" disabled={confirming}>{confirming ? "Checking…" : "Turn on two-step sign-in"}</button>
    </form>
  );
}

/** Confirm this session with the authenticator app (needed for staff pages). */
export function VerifyForm({ next }: { next: string }) {
  const [state, verify, pending] = useActionState<VerifyState, FormData>(verifyCode, undefined);
  return (
    <form action={verify} className="stack">
      <input type="hidden" name="next" value={next} />
      <CodeField />
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button type="submit" className="btn-grad" disabled={pending}>{pending ? "Checking…" : "Continue"}</button>
    </form>
  );
}
