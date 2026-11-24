"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { creationOptionsFromJSON, credentialToJSON, requestOptionsFromJSON } from "@/lib/webauthn-json";
import { Button, Field, Input } from "@/design";
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
  const t = useTranslations("account.passkey");
  const supported = usePasskeySupport();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The suggested name reads the browser (navigator), so it's set after hydration: the server and
  // the first browser render both use the plain default, and nothing mismatches.
  const [suggested, setSuggested] = useState(() => t("defaultName"));
  useEffect(() => { setSuggested(defaultName(t)); }, [t]);

  async function add() {
    setBusy(true);
    setError("");
    try {
      const started = await startPasskeyEnroll(name || suggested);
      if ("error" in started) return setError(started.error);
      const cred = (await navigator.credentials.create({ publicKey: creationOptionsFromJSON(started.options) })) as PublicKeyCredential | null;
      if (!cred) return setError(t("errors.notCreated"));
      const done = await finishPasskey({ factorId: started.factorId, challengeId: started.challengeId, type: "create", credential: credentialToJSON(cred), next });
      if ("error" in done) return setError(done.error);
      // A full load, so the server sees the session cookie that was just upgraded.
      window.location.assign(done.next);
    } catch (e) {
      setError(cancelled(e) ? t("errors.addCancelled") : t("errors.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (supported === false) return <p className="muted small">{t("unsupported")}</p>;
  return (
    <div className="stack">
      <Field label={t("nameLabel")}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={suggested} />
      </Field>
      {error && <p className="error" role="alert">{error}</p>}
      <Button variant="primary" onClick={add} disabled={busy || supported === null}>{busy ? t("waiting") : t("add")}</Button>
    </div>
  );
}

/** Confirm this session with a passkey already added. */
export function UsePasskey({ factorId, name, next }: { factorId: string; name: string | null; next: string }) {
  const t = useTranslations("account.passkey");
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
      if (!cred) return setError(t("errors.notUsed"));
      const done = await finishPasskey({ factorId, challengeId: started.challengeId, type: "request", credential: credentialToJSON(cred), next });
      if ("error" in done) return setError(done.error);
      // A full load, so the server sees the session cookie that was just upgraded.
      window.location.assign(done.next);
    } catch (e) {
      setError(cancelled(e) ? t("errors.useCancelled") : t("errors.useFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (supported === false) return null;
  return (
    <div className="stack">
      {error && <p className="error" role="alert">{error}</p>}
      <Button variant="accent" onClick={use} disabled={busy || supported === null}>{busy ? t("waiting") : name ? t("useNamed", { name }) : t("use")}</Button>
    </div>
  );
}

function defaultName(t: (key: "defaultName" | "deviceName", values?: { device: string }) => string): string {
  if (typeof navigator === "undefined") return t("defaultName");
  const ua = navigator.userAgent;
  const device = /iPhone|iPad/.test(ua) ? "iPhone" : /Mac/.test(ua) ? "Mac" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : null;
  return device ? t("deviceName", { device }) : t("defaultName");
}
