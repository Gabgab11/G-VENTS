"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/redirect";
import BackLink from "@/components/BackLink";
import OtpInput from "@/components/OtpInput";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Visitors who tapped a "Create event" button see a sign-up welcome.
  const [fromCreate, setFromCreate] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFromCreate(params.get("next") === "/events/new");
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
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) return setError(error.message);
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
    <main className="auth-wrap">
      <div className="auth-card">
        <div className="back-row"><BackLink fallback="/" label="← Back" /></div>
        <div className="auth-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f2a33a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H3" />
          </svg>
        </div>

        <h1 className="auth-title">{fromCreate ? "Create your free account" : "Create your account or sign in"}</h1>

        {!sent ? (
          <>
          <button type="button" className="auth-google" onClick={continueWithGoogle} disabled={busy}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </button>
          <div className="auth-divider" role="separator"><span>or</span></div>
          <form onSubmit={sendCode} className="auth-form">
            <p className="muted">
              {fromCreate
                ? "Enter your email and we'll create your free account. No password needed. Then you'll go straight to creating your event. Already have an account? The same email signs you in."
                : "New here? Enter your email and we'll create your free account. No password needed."}
            </p>
            <label className="auth-label" htmlFor="sign-in-email">Email</label>
            <input id="sign-in-email" className="auth-input" type="email" required autoFocus autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
            <button className="auth-primary" type="submit" disabled={busy}>
              {busy ? "Sending code..." : "Continue with Email"}
            </button>
          </form>
          </>
        ) : (
          <div className="auth-form">
            <p className="muted">Enter the 6-digit code we sent to <span className="auth-email">{email}</span>.</p>
            <OtpInput length={6} onComplete={verifyCode} />
            {busy && <p className="muted" role="status">Checking...</p>}
            <button type="button" className="auth-link" onClick={() => { setSent(false); setError(null); }}>
              Use a different email
            </button>
          </div>
        )}

        {error && <p className="error auth-error" role="alert">{error}</p>}
      </div>
    </main>
  );
}
