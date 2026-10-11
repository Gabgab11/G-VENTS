"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function nextPath() {
    if (typeof window === "undefined") return "/dashboard";
    return new URLSearchParams(window.location.search).get("next") || "/dashboard";
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

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) return setError("That code is wrong or has expired. Try again or request a new one.");
    window.location.href = nextPath();
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <div className="auth-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f2a33a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H3" />
          </svg>
        </div>

        <h1 className="auth-title">Welcome to G-vents</h1>

        {!sent ? (
          <form onSubmit={sendCode} className="auth-form">
            <p className="muted">Please sign in or sign up below.</p>
            <label className="auth-label">Email</label>
            <input className="auth-input" type="email" required autoFocus value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
            <button className="auth-primary" type="submit" disabled={busy}>
              {busy ? "Sending code..." : "Continue with Email"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="auth-form">
            <p className="muted">Enter the 6-digit code we sent to <span className="auth-email">{email}</span>.</p>
            <input className="auth-input auth-code" inputMode="numeric" maxLength={6} required autoFocus value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" />
            <button className="auth-primary" type="submit" disabled={busy}>
              {busy ? "Checking..." : "Sign in"}
            </button>
            <button type="button" className="auth-link" onClick={() => { setSent(false); setCode(""); setError(null); }}>
              Use a different email
            </button>
          </form>
        )}

        {error && <p className="error auth-error">{error}</p>}
      </div>
    </main>
  );
}
