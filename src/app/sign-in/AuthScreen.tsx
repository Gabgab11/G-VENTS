"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { pageFonts } from "@/app/fonts";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/redirect";
import BackLink from "@/components/BackLink";
import OtpInput from "@/components/OtpInput";
import Turnstile, { type TurnstileHandle } from "@/components/Turnstile";
import { env } from "@/lib/env";
import ColorModeToggle from "@/components/ColorModeToggle";
import SignInArt from "./SignInArt";

export type AuthMode = "signin" | "signup";

// Log in and sign up share one screen (no passwords: Google or a 6-digit email code). Log in only
// sends codes to existing accounts, so a typo or a new visitor is pointed to sign up instead of
// silently creating an account; sign up creates it. Google does both.
export default function AuthScreen({ mode }: { mode: AuthMode }) {
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
    setNext(n ? `?next=${encodeURIComponent(safeNextPath(n))}` : "");
    if (params.get("error") === "google") setError("Google sign-in didn't finish. Try again, or use your email.");
  }, []);

  function nextPath() {
    if (typeof window === "undefined") return "/dashboard";
    return safeNextPath(new URLSearchParams(window.location.search).get("next"));
  }

  // Google returns to /auth/callback, which sets the session and continues to `next`.
  async function continueWithGoogle() {
    setError(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", nextPath());
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback.toString() } });
    if (error) {
      setBusy(false);
      setError("Google sign-in isn't available right now. Use your email instead.");
    }
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNoAccount(false);
    if (siteKey && !captchaToken) return setError("Please wait a moment while we check you're not a robot, then try again.");
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: mode === "signup", ...(siteKey && captchaToken ? { captchaToken } : {}) },
    });
    setBusy(false);
    // Each token works once: get a fresh one for the next request.
    captcha.current?.reset();
    if (error) {
      // Log in for an address with no account: Supabase refuses with "Signups not allowed for otp".
      if (mode === "signin" && (error.code === "otp_disabled" || /signups? not allowed/i.test(error.message))) return setNoAccount(true);
      return setError(error.message);
    }
    setSent(true);
  }

  async function verifyCode(code: string) {
    setError(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
    setBusy(false);
    if (error) return setError("That code is wrong or has expired. Try again or request a new one.");
    window.location.href = nextPath();
  }

  return (
    <main className={`si ${pageFonts}`}>
      <section className="si-panel">
        <header className="si-top">
          <Link href="/" className="si-logo">G-vent<b>Z</b></Link>
          <div className="si-top-right">
            <ColorModeToggle />
            <BackLink fallback="/" label="← Back" />
          </div>
        </header>

        <div className="si-body">
          {!sent ? (
            <>
              <p className="si-eyebrow">{mode === "signin" ? "Welcome back" : fromCreate ? "Free to host" : "Free to join"}</p>
              <h1 className="si-title">
                {mode === "signin" ? (fromCreate ? "Log in to create your event" : "Log in to your account") : fromCreate ? "Create your free account" : "Create your account"}
              </h1>
              <p className="si-sub">
                {mode === "signin"
                  ? "Use Google, or we'll email you a 6-digit code. No password needed."
                  : fromCreate
                    ? "One account to create your event, share it and check guests in. No password needed."
                    : "Get tickets and host your own events. Use Google, or we'll email you a 6-digit code. No password needed."}
              </p>

              <button type="button" className="si-google" onClick={continueWithGoogle} disabled={busy}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
                Continue with Google
              </button>
              <div className="si-divider" role="separator"><span>or use your email</span></div>
              <form onSubmit={sendCode} className="si-form">
                <label className="si-label" htmlFor="sign-in-email">Email address</label>
                <input id="sign-in-email" className="si-input" type="email" required autoFocus autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
                {siteKey && (
                  <Turnstile ref={captcha} siteKey={siteKey} onToken={setCaptchaToken}
                    onError={() => setError("The robot check didn't load. Refresh the page, or continue with Google.")} />
                )}
                <button className="si-primary" type="submit" disabled={busy}>
                  {busy ? "Sending code..." : "Email me a code"}
                </button>
              </form>
            </>
          ) : (
            <div className="si-form">
              <p className="si-eyebrow">Check your inbox</p>
              <h1 className="si-title">Enter your code</h1>
              <p className="si-sub">We sent a 6-digit code to <span className="auth-email">{email}</span>. It expires in a few minutes.</p>
              <OtpInput length={6} onComplete={verifyCode} />
              {busy && <p className="muted" role="status">Checking...</p>}
              <button type="button" className="si-link" onClick={() => { setSent(false); setError(null); }}>
                Use a different email
              </button>
            </div>
          )}

          {noAccount && (
            <p className="error si-error" role="alert">
              There&apos;s no account for {email.trim()} yet. <Link href={`/sign-up${next}`} className="gold">Sign up with this email</Link>
            </p>
          )}
          {error && <p className="error si-error" role="alert">{error}</p>}

          {!sent && (
            <p className="si-switch">
              {mode === "signin" ? (
                <>Don&apos;t have an account? <Link href={`/sign-up${next}`} className="gold">Sign up</Link></>
              ) : (
                <>Already have an account? <Link href={`/sign-in${next}`} className="gold">Log in</Link></>
              )}
            </p>
          )}
        </div>

        <p className="si-legal">
          By continuing you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>

      <SignInArt />
    </main>
  );
}
