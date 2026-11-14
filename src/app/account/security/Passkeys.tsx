"use client";

import { useEffect, useState } from "react";
import { creationOptionsFromJSON, credentialToJSON, requestOptionsFromJSON } from "@/lib/webauthn-json";
import { finishPasskey, startPasskeyEnroll, startPasskeyVerify } from "./passkey-actions";

function cancelled(e: unknown): boolean {
  return e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "AbortError");
}

function usePasskeySupport(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => setOk(typeof window !== "undefined" && "PublicKeyCredential" in window && !!navigator.credentials?.create), []);
  return ok;
}

/** Add a passkey on this device (or a phone / security key) as the second step of sign-in. */
export function AddPasskey({ next }: { next: string }) {
  const supported = usePasskeySupport();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    setBusy(true);
    setError("");
    try {
      const started = await startPasskeyEnroll(name || defaultName());
      if ("error" in started) return setError(started.error);
      const cred = (await navigator.credentials.create({ publicKey: creationOptionsFromJSON(started.options) })) as PublicKeyCredential | null;
      if (!cred) return setError("No passkey was created.");
      const done = await finishPasskey({ factorId: started.factorId, challengeId: started.challengeId, type: "create", credential: credentialToJSON(cred), next });
      if ("error" in done) return setError(done.error);
      // A full load, so the server sees the session cookie that was just upgraded.
      window.location.assign(done.next);
    } catch (e) {
      setError(cancelled(e) ? "Cancelled. Nothing was added." : "This device couldn't create a passkey. Try another device or the authenticator app.");
    } finally {
      setBusy(false);
    }
  }

  if (supported === false) return <p className="muted small">This browser doesn&apos;t support passkeys. Use the authenticator app instead.</p>;
  return (
    <div className="stack">
      <label className="field"><span>Name this passkey (optional)</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={defaultName()} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="btn-white" onClick={add} disabled={busy || supported === null}>{busy ? "Waiting for your device…" : "Add a passkey"}</button>
    </div>
  );
}

/** Confirm this session with a passkey already added. */
export function UsePasskey({ factorId, name, next }: { factorId: string; name: string | null; next: string }) {
  const supported = usePasskeySupport();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function use() {
    setBusy(true);
    setError("");
    try {
      const started = await startPasskeyVerify(factorId);
      if ("error" in started) return setError(started.error);
      const cred = (await navigator.credentials.get({ publicKey: requestOptionsFromJSON(started.options) })) as PublicKeyCredential | null;
      if (!cred) return setError("No passkey was used.");
      const done = await finishPasskey({ factorId, challengeId: started.challengeId, type: "request", credential: credentialToJSON(cred), next });
      if ("error" in done) return setError(done.error);
      // A full load, so the server sees the session cookie that was just upgraded.
      window.location.assign(done.next);
    } catch (e) {
      setError(cancelled(e) ? "Cancelled." : "That passkey couldn't be used on this device.");
    } finally {
      setBusy(false);
    }
  }

  if (supported === false) return null;
  return (
    <div className="stack">
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="btn-grad" onClick={use} disabled={busy || supported === null}>{busy ? "Waiting for your device…" : `Use passkey${name ? `: ${name}` : ""}`}</button>
    </div>
  );
}

function defaultName(): string {
  if (typeof navigator === "undefined") return "Passkey";
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iPhone passkey";
  if (/Mac/.test(ua)) return "Mac passkey";
  if (/Android/.test(ua)) return "Android passkey";
  if (/Windows/.test(ua)) return "Windows passkey";
  return "Passkey";
}
