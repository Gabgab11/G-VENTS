"use client";

import { markLeavingSignIn } from "@/lib/auth-floor";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { pageFonts } from "@/app/fonts";
import { sendEmailCode, startGoogleSignIn, verifyEmailCode } from "@/app/(site)/auth/actions";
import type { AuthMode } from "@/lib/email-code";
import { safeNextPath } from "@/lib/redirect";
import BackLink from "@/components/BackLink";
import OtpInput from "@/components/OtpInput";
import Turnstile, { type TurnstileHandle } from "@/components/Turnstile";
import { env } from "@/lib/env";
import ColorModeToggle from "@/components/ColorModeToggle";

// Log in and sign up share one screen (no passwords: Google or a 6-digit email code). Log in only
// sends codes to existing accounts, so a typo or a new visitor is pointed to sign up instead of
// silently creating an account; sign up creates it. Google does both. Every Supabase call runs in a
// server action (src/app/auth/actions.ts): the browser never talks to Supabase. The picture (`art`,
// SignInArt) is rendered on the server by the page, so its text is translated there.
export default function AuthScreen({ mode, art }: { mode: AuthMode; art: ReactNode }) {
  const t = useTranslations("auth.screen");
  const tr = useTranslations();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noAccount, setNoAccount] = useState(false);
  const [next, setNext] = useState("");
  // Bot protection (FR-1.7): with a site key set, a code is only requested with a Turnstile token.
  const siteKey = env.turnstileSiteKey;
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<TurnstileHandle>(null);
  // Visitors who tapped a "Create event" button see a sign-up welcome.
  const [fromCreate, setFromCreate] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFromCreate(params.get("next") === "/events/new");
    const n = params.get("next");
    setNext(n ? `?next=${encodeURIComponent(safeNextPath(n, "/my-tickets"))}` : "");
    if (params.get("error") === "google") setError(t("googleDidntFinish"));
  }, [t]);

  function nextPath() {
    // No (or an unsafe) `next`: a guest's tickets, not the host dashboard (D82).
    if (typeof window === "undefined") return "/my-tickets";
    return safeNextPath(new URLSearchParams(window.location.search).get("next"), "/my-tickets");
  }

  // Google returns to /auth/callback, which sets the session and continues to `next`.
  async function continueWithGoogle() {
    setError(null);
    setBusy(true);
    const result = await startGoogleSignIn(nextPath()).catch(() => ({ error: t("googleUnavailable") }));
    if ("url" in result) {
      markLeavingSignIn();
      window.location.href = result.url;
      return;
    }
    setBusy(false);
    setError(result.error);
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNoAccount(false);
    if (siteKey && !captchaToken) return setError(t("captchaWait"));
    setBusy(true);
    const result = await sendEmailCode({ email, mode, captchaToken: siteKey ? captchaToken : null }).catch(
      () => ({ ok: false, reason: "failed", message: tr("shared.emailCode.sendFailed") }) as const,
    );
    setBusy(false);
    // Each token works once: get a fresh one for the next request.
    captcha.current?.reset();
    setCaptchaToken(null);
    if (!result.ok) {
      if (result.reason === "no_account") return setNoAccount(true);
      return setError(result.message);
    }
    setSent(true);
  }

  async function verifyCode(code: string) {
    setError(null);
    setBusy(true);
    const result = await verifyEmailCode({ email, code }).catch(
      () => ({ ok: false, message: t("verifyFailed") }) as const,
    );
    setBusy(false);
    if (!result.ok) return setError(result.message);
    markLeavingSignIn();
    // replace, not a new entry: the sign-in page doesn't stay in this tab's history.
    window.location.replace(nextPath());
  }

  return (
    <main className={`si ${pageFonts}`}>
      <section className="si-panel">
        <header className="si-top">
          <Link href="/" className="si-logo">G-vent<b>Z</b></Link>
          <div className="si-top-right">
            <ColorModeToggle />
            <BackLink fallback="/" label={t("back")} />
          </div>
        </header>

        <div className="si-body">
          {!sent ? (
            <>
              <p className="si-eyebrow">{mode === "signin" ? t("signin.eyebrow") : fromCreate ? t("signup.eyebrowCreate") : t("signup.eyebrow")}</p>
              <h1 className="si-title">
                {mode === "signin" ? (fromCreate ? t("signin.titleCreate") : t("signin.title")) : fromCreate ? t("signup.titleCreate") : t("signup.title")}
              </h1>
              <p className="si-sub">
                {mode === "signin"
                  ? t("signin.sub")
                  : fromCreate
                    ? t("signup.subCreate")
                    : t("signup.sub")}
              </p>

              <button type="button" className="si-google" onClick={continueWithGoogle} disabled={busy}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
                {t("google")}
              </button>
              <div className="si-divider" role="separator"><span>{t("divider")}</span></div>
              <form onSubmit={sendCode} className="si-form">
                <label className="si-label" htmlFor="sign-in-email">{t("emailLabel")}</label>
                <input id="sign-in-email" className="si-input" type="email" required autoFocus autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} />
                {siteKey && (
                  <Turnstile ref={captcha} siteKey={siteKey} onToken={setCaptchaToken}
                    onError={() => setError(t("captchaLoad"))} />
                )}
                <button className="si-primary" type="submit" disabled={busy}>
                  {busy ? t("sending") : t("send")}
                </button>
              </form>
            </>
          ) : (
            <div className="si-form">
              <p className="si-eyebrow">{t("code.eyebrow")}</p>
              <h1 className="si-title">{t("code.title")}</h1>
              <p className="si-sub">{t.rich("code.sub", { email, address: (c) => <span className="auth-email">{c}</span> })}</p>
              <OtpInput length={6} onComplete={verifyCode} />
              {busy && <p className="muted" role="status">{t("code.checking")}</p>}
              <button type="button" className="si-link" onClick={() => { setSent(false); setError(null); }}>
                {t("code.differentEmail")}
              </button>
            </div>
          )}

          {noAccount && (
            <p className="error si-error" role="alert">
              {t.rich("noAccount", { email: email.trim(), link: (c) => <Link href={`/sign-up${next}`} className="gold">{c}</Link> })}
            </p>
          )}
          {error && <p className="error si-error" role="alert">{error}</p>}

          {!sent && (
            <p className="si-switch">
              {mode === "signin" ? (
                <>{t.rich("switchToSignUp", { link: (c) => <Link href={`/sign-up${next}`} className="gold">{c}</Link> })}</>
              ) : (
                <>{t.rich("switchToSignIn", { link: (c) => <Link href={`/sign-in${next}`} className="gold">{c}</Link> })}</>
              )}
            </p>
          )}
        </div>

        <p className="si-legal">
          {t.rich("legal", { terms: (c) => <Link href="/terms">{c}</Link>, privacy: (c) => <Link href="/privacy">{c}</Link> })}
        </p>
      </section>

      {art}
    </main>
  );
}
