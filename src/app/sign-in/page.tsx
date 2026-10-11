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
    if (typeof window === "undefined") return "/events/new";
    return new URLSearchParams(window.location.search).get("next") || "/events/new";
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
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) return setError("That code is wrong or has expired. Try again or request a new one.");
    window.location.href = nextPath();
  }

  return (
    <main className="wrap page">
      <h1>Sign in</h1>
      <p className="muted">We&apos;ll email you a 6-digit code. No password needed.</p>

      {!sent ? (
        <form className="form" onSubmit={sendCode}>
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
          </label>
          <button className="btn-white" type="submit" disabled={busy}>{busy ? "Sending..." : "Send code"}</button>
        </form>
      ) : (
        <form className="form" onSubmit={verifyCode}>
          <p className="muted">We sent a code to {email}.</p>
          <label className="field">
            <span>6-digit code</span>
            <input className="input" inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <button className="btn-white" type="submit" disabled={busy}>{busy ? "Checking..." : "Sign in"}</button>
          <button type="button" className="link-btn" onClick={() => setSent(false)}>Use a different email</button>
        </form>
      )}

      {error && <p className="error">{error}</p>}
    </main>
  );
}
