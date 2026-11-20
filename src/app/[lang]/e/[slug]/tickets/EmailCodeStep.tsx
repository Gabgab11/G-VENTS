"use client";

import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { sendEmailCode, verifyEmailCode } from "@/app/(site)/auth/actions";
import { normalizeEmail } from "@/lib/email-code";
import { env } from "@/lib/env";
import OtpInput from "@/components/OtpInput";
import Turnstile, { type TurnstileHandle } from "@/components/Turnstile";
import { Button, Field, Input } from "@/design";
import { emailStepReducer, initialEmailStep, resendIn } from "./email-step";
import { broadcastDraft } from "./use-booking-draft";
import b from "./Booking.module.css";

type Props = {
  idPrefix: string;
  /** The buyer's name field in the same form; checked before a code is sent. */
  nameField: string;
  /** Called once the code is right and the session cookie is set. */
  onSignedIn: () => void;
};

// The buyer's email for a signed-out visitor on the booking page (Change 4 chunk 3d, D88): email →
// Continue → the 6-digit sign-in code typed right here → signed in, and the page refreshes with the
// account email while the form keeps everything typed (use-booking-draft.ts). The same server actions,
// Supabase flow and Turnstile check as the sign-in page; a new email gets an account ("signup" mode
// creates it, and signs an existing account in too). No history entries are added, so Back never
// returns to a code screen. Lives inside the order form, so its buttons are type="button".
export default function EmailCodeStep({ idPrefix, nameField, onSignedIn }: Props) {
  const t = useTranslations("event.verify");
  const tg = useTranslations("event.guest");
  const root = useTranslations();
  const router = useRouter();
  const [state, dispatch] = useReducer(emailStepReducer, initialEmailStep);
  const [email, setEmail] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const continueRef = useRef<HTMLButtonElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const siteKey = env.turnstileSiteKey;
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);

  // A clock for the resend countdown, only while the code step is showing.
  useEffect(() => {
    if (state.step !== "code") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.step]);

  // Back to the email field after "Change email".
  const wasCode = useRef(false);
  useEffect(() => {
    if (state.step === "email" && wasCode.current) emailRef.current?.focus();
    wasCode.current = state.step === "code";
  }, [state.step]);

  async function requestCode(address: string) {
    if (siteKey && !captchaToken) return dispatch({ type: "failed", message: t("captchaWait") });
    const result = await sendEmailCode({ email: address, mode: "signup", captchaToken: siteKey ? captchaToken : null }).catch(
      () => ({ ok: false, reason: "failed", message: root("shared.emailCode.sendFailed") }) as const,
    );
    // Each token works once: get a fresh one for the next request.
    captcha.current?.reset();
    if (!result.ok) return dispatch({ type: "failed", message: result.reason === "captcha" ? t("captchaFailed") : result.message });
    const at = Date.now();
    setNow(at);
    dispatch({ type: "sent", email: address, at });
  }

  function start() {
    if (state.step !== "email" || state.busy) return;
    const form = continueRef.current?.form;
    const name = form?.elements.namedItem(nameField);
    if (name instanceof HTMLInputElement && !name.checkValidity()) {
      name.focus();
      return dispatch({ type: "failed", message: t("nameFirst") });
    }
    const address = normalizeEmail(email);
    if (!address) {
      emailRef.current?.focus();
      return dispatch({ type: "failed", message: root("shared.emailCode.invalid") });
    }
    dispatch({ type: "send" });
    void requestCode(address);
  }

  function resend() {
    if (state.step !== "code" || state.busy || resendIn(state, now) > 0) return;
    dispatch({ type: "resend" });
    void requestCode(state.email);
  }

  async function verify(code: string) {
    if (state.step !== "code" || state.busy) return;
    dispatch({ type: "verify" });
    // Saved before the call: the sign-in refreshes the page, which may remount the forms.
    broadcastDraft("save");
    const result = await verifyEmailCode({ email: state.email, code }).catch(() => ({ ok: false, message: t("verifyFailed") }) as const);
    if (!result.ok) {
      broadcastDraft("clear");
      return dispatch({ type: "failed", message: result.message });
    }
    dispatch({ type: "verified" });
    onSignedIn();
    router.refresh();
  }

  function onEmailKey(e: KeyboardEvent<HTMLInputElement>) {
    // Enter continues here instead of submitting the order form.
    if (e.key === "Enter") {
      e.preventDefault();
      start();
    }
  }

  if (state.step === "code" || state.step === "done") {
    const done = state.step === "done";
    const wait = resendIn(state, now);
    const busy = state.step === "code" ? state.busy : null;
    return (
      <div className={b.verify} role="group" aria-labelledby={`${idPrefix}-code-title`}>
        <p className={b.verifyTitle} id={`${idPrefix}-code-title`}>{t("codeTitle")}</p>
        <p className={b.note}>{t.rich("codeSent", { email: state.email, address: (c) => <bdi dir="ltr" className={b.verifyEmail}>{c}</bdi> })}</p>
        {!done && (
          <div className={b.otp}>
            <OtpInput key={state.attempt} length={6} onComplete={verify} label={t("codeLabel")} disabled={busy === "verifying"} />
          </div>
        )}
        <div aria-live="polite" className={b.verifyStatus}>
          {busy === "verifying" && <p className={b.note} role="status">{t("checking")}</p>}
          {done && <p className={b.note} role="status">{t("signedIn")}</p>}
          {state.step === "code" && state.notice === "resent" && <p className={b.note} role="status">{t("resent")}</p>}
        </div>
        {state.step === "code" && state.error && <p className={b.error} role="alert">{state.error}</p>}
        {!done && (
          <div className={b.verifyActions}>
            <Button type="button" variant="ghost" size="sm" onClick={() => dispatch({ type: "changeEmail" })} disabled={!!busy}>
              {t("changeEmail")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={resend} disabled={!!busy || wait > 0} loading={busy === "resending"}>
              {wait > 0 ? t("resendIn", { seconds: wait }) : t("resend")}
            </Button>
          </div>
        )}
        {siteKey && !done && (
          <Turnstile ref={captcha} siteKey={siteKey} onToken={setCaptchaToken} onError={() => dispatch({ type: "failed", message: t("captchaLoad") })} />
        )}
      </div>
    );
  }

  return (
    <div className={b.verify}>
      <Field label={tg("email")} hint={t("emailHint")} error={state.error ?? undefined} id={`${idPrefix}-email`}>
        <Input ref={emailRef} type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEmailKey}
          autoComplete="email" inputMode="email" dir="ltr" maxLength={254} placeholder={t("emailPlaceholder")} />
      </Field>
      {siteKey && (
        <Turnstile ref={captcha} siteKey={siteKey} onToken={setCaptchaToken} onError={() => dispatch({ type: "failed", message: t("captchaLoad") })} />
      )}
      <Button ref={continueRef} type="button" variant="primary" onClick={start} loading={state.busy} className={b.verifyContinue}>
        {state.busy ? t("sending") : t("continue")}
      </Button>
    </div>
  );
}
