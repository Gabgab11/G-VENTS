"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { Banner, Button, Card, CardHeader, Field, Input, Textarea } from "@/design";
import { BIO_MAX, LOCATION_MAX, handleProblem, normalizeHandle, profilePath } from "@/lib/host-profile";
import { checkHandle, saveProfile, type HandleCheck, type SaveState } from "./actions";
import s from "./profile.module.css";

type Values = { handle: string; name: string; bio: string; location: string; instagram: string; facebook: string; x: string; website: string };

const NETWORKS = [
  { field: "instagram", label: "Instagram", placeholder: "@yourname" },
  { field: "facebook", label: "Facebook", placeholder: "facebook.com/yourpage" },
  { field: "x", label: "X", placeholder: "@yourname" },
] as const;

/** The handle's live check: format and reserved words at once, then (debounced) whether it's free. */
function useHandleCheck(typed: string, saved: string, ownId: string): HandleCheck | "checking" | null {
  const [result, setResult] = useState<{ handle: string; check: HandleCheck } | null>(null);
  const handle = normalizeHandle(typed);
  const local = handle === "" ? null : handleProblem(handle);
  const remote = handle !== "" && !local && handle !== saved;
  useEffect(() => {
    if (!remote) return;
    let live = true;
    const timer = setTimeout(() => {
      checkHandle(handle, ownId)
        .then((check) => live && setResult({ handle, check }))
        .catch(() => live && setResult({ handle, check: "unknown" }));
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [handle, remote, ownId]);
  if (handle === "") return null;
  if (local) return local;
  if (handle === saved) return "yours";
  return result?.handle === handle ? result.check : "checking";
}

export default function ProfileForm({ initial, ownId, site }: { initial: Values; ownId: string; site: string }) {
  const t = useTranslations("profile.settings");
  const [state, action, pending] = useActionState<SaveState, FormData>(saveProfile, undefined);
  const [saved, setSaved] = useState({ handle: initial.handle, name: initial.name });
  const [handle, setHandle] = useState(initial.handle);
  const [bio, setBio] = useState(initial.bio);
  const lastSave = useRef<number | null>(null);

  // After a save, the saved handle and name are what later changes compare against.
  useEffect(() => {
    if (state?.ok && lastSave.current !== state.at) {
      lastSave.current = state.at;
      setSaved((prev) => ({ handle: state.handle ?? prev.handle, name: state.name }));
      if (state.handle) setHandle(state.handle);
    }
  }, [state]);

  const check = useHandleCheck(handle, saved.handle, ownId);
  const normalized = normalizeHandle(handle);
  const changing = saved.handle !== "" && normalized !== "" && normalized !== saved.handle && (check === "available" || check === "checking" || check === "unknown");
  const fieldError = (f: keyof Values) => (state && !state.ok ? state.fields[f] : undefined);
  const checkText =
    check === "checking" ? t("checking")
    : check === "available" ? t("available")
    : check === "yours" ? t("yours")
    : check === "taken" ? t("taken")
    : check === "reserved" ? t("reserved")
    : check === "invalid" ? t("invalid")
    : null;
  const checkBad = check === "taken" || check === "reserved" || check === "invalid";

  return (
    <form action={action} className={s.form} noValidate>
      <input type="hidden" name="savedHandle" value={saved.handle} />
      <input type="hidden" name="savedName" value={saved.name} />

      <Card as="section" aria-labelledby="profile-public">
        <CardHeader
          title={<span id="profile-public">{t("title")}</span>}
          action={saved.handle ? (
            <Button href={profilePath(saved.handle)} variant="ghost" size="sm" target="_blank" rel="noopener">
              {t("viewProfile")}
              <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
            </Button>
          ) : undefined}
        />
        <p className={s.lead}>{saved.handle ? t("lead") : t("noHandle")}</p>

        <Field
          label={t("handle")}
          hint={
            <span className={s.handleHint}>
              <span>{t("handleHint")}</span>
              {normalized && !checkBad && <span dir="ltr" className={s.address}>{t("address", { address: `${site}${profilePath(normalized)}` })}</span>}
            </span>
          }
          error={fieldError("handle") ?? (checkBad ? checkText : undefined)}
        >
          <Input
            name="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={31}
            dir="ltr"
            inputMode="url"
          />
        </Field>
        <p className={s.check} aria-live="polite" data-tone={check === "available" || check === "yours" ? "good" : undefined}>
          {!checkBad && checkText ? checkText : null}
        </p>
        {changing && <Banner tone="warning" title={t("changeTitle")}>{t("changeWarning")}</Banner>}

        <Field label={t("name")} hint={t("nameHint")} error={fieldError("name")}>
          <Input name="name" defaultValue={initial.name} maxLength={120} autoComplete="name" />
        </Field>
        <Field label={t("bio")} hint={t("bioCount", { count: Math.max(0, BIO_MAX - bio.length) })} error={fieldError("bio")}>
          <Textarea name="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={BIO_MAX} rows={4} />
        </Field>
        <Field label={t("location")} hint={t("locationHint")} error={fieldError("location")}>
          <Input name="location" defaultValue={initial.location} maxLength={LOCATION_MAX} autoComplete="address-level2" />
        </Field>
      </Card>

      <Card as="section" aria-labelledby="profile-links">
        <CardHeader title={<span id="profile-links">{t("linksTitle")}</span>} />
        <div className={s.links}>
          {NETWORKS.map((n) => (
            <Field key={n.field} label={n.label} hint={t("socialHint")} error={fieldError(n.field)}>
              <Input name={n.field} defaultValue={initial[n.field]} placeholder={n.placeholder} dir="ltr" autoCapitalize="none" spellCheck={false} maxLength={300} />
            </Field>
          ))}
          <Field label={t("website")} hint={t("websiteHint")} error={fieldError("website")}>
            <Input name="website" type="url" defaultValue={initial.website} placeholder="https://" dir="ltr" maxLength={300} />
          </Field>
        </div>
      </Card>

      <div className={s.footer}>
        {state && !state.ok && <Banner tone="danger" title={state.message} />}
        {state?.ok && !pending && <Banner tone="success" title={t("saved")} />}
        <Button type="submit" variant="primary" loading={pending} disabled={checkBad}>{pending ? t("saving") : t("save")}</Button>
      </div>
    </form>
  );
}
