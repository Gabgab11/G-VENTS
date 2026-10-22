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
    setFromCreate(new URLSearchParams(window.location.search).get("next") === "/events/new");
  }, []);

  function nextPath() {
    if (typeof window === "undefined") return "/dashboard";
    return safeNextPath(new URLSearchParams(window.location.search).get("next"));
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
