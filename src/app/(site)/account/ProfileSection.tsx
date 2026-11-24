"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ImageUp, Trash2 } from "lucide-react";
import { Avatar, Banner, Button, Card, CardHeader, Field, Input, Select } from "@/design";
import { useToast } from "@/design/client";
import { refreshSession } from "@/lib/use-session";
import { NAME_MAX, type Gender } from "./account-input";
import { removeAvatar, saveProfile, type ProfileState } from "./actions";
import s from "./account.module.css";

// Profile (FR-35): the avatar, chosen and previewed at once, then uploaded through this site's
// route (/api/me/profile/images, shared with host Settings → Profile); then name, the sign-in email
// (read-only), phone with its country, and gender, saved together.

const MAX = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export type ProfileProps = {
  email: string;
  fullName: string;
  avatarUrl: string | null;
  /** The saved phone split for the picker, or the default country and an empty number. */
  phone: { country: string; national: string };
  countries: { value: string; label: string }[];
  gender: Gender | null;
};

function AvatarPicker({ name, initialUrl }: { name: string; initialUrl: string | null }) {
  const t = useTranslations("account.page.profile");
  const errors = useTranslations("errors");
  const { toast } = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const problem = (code: string) =>
    code === "flyer_type" || code === "host.image_type" ? t("avatarType")
    : code === "flyer_size" || code === "host.image_size" ? t("avatarSize")
    : code === "signed_out" ? t("signedOut")
    : errors.has(code) ? errors(code)
    : t("avatarFailed");

  const done = (text: string) => {
    toast({ title: text, tone: "success" });
    void refreshSession();
    router.refresh();
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (!TYPES.includes(file.type)) return setError(t("avatarType"));
    if (file.size > MAX) return setError(t("avatarSize"));
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    const body = new FormData();
    body.set("kind", "avatar");
    body.set("flyer", file);
    const res = await fetch("/api/me/profile/images", { method: "POST", body, headers: { Accept: "application/json" } }).catch(() => null);
    const reply = (await res?.json().catch(() => null)) as { ok: true; url: string | null } | { ok: false; code: string } | null;
    setBusy(false);
    setPreview(null);
    if (input.current) input.current.value = "";
    if (reply?.ok) {
      setUrl(reply.url);
      done(t("avatarSaved"));
    } else setError(problem(reply && !reply.ok ? reply.code : "failed"));
  };

  const remove = async () => {
    setBusy(true);
    setError("");
    const result = await removeAvatar().catch(() => ({ ok: false as const, message: t("avatarFailed") }));
    setBusy(false);
    if (result.ok) {
      setUrl(null);
      done(t("avatarRemoved"));
    } else setError(result.message);
  };

  const shown = preview ?? url;
  return (
    <div className={s.avatarRow}>
      <span aria-busy={busy || undefined}>
        <Avatar name={name || t("avatar")} src={shown} size={48} className={s.avatarLarge} />
      </span>
      <div className={s.avatarText}>
        <label htmlFor="account-avatar" className={s.label}>{t("avatar")}</label>
        <p className={s.hint} id="account-avatar-hint">{t("avatarHint")}</p>
        <input
          ref={input}
          id="account-avatar"
          type="file"
          accept={TYPES.join(",")}
          className="sr-only"
          aria-describedby="account-avatar-hint"
          onChange={(e) => void choose(e.target.files?.[0])}
          disabled={busy}
        />
        <div className={s.row}>
          <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => input.current?.click()}>
            {!busy && <ImageUp size={16} strokeWidth={1.75} aria-hidden />}
            {busy ? t("uploading") : url ? t("replace") : t("upload")}
          </Button>
          {url && !busy && (
            <Button type="button" size="sm" variant="ghost" onClick={() => void remove()}>
              <Trash2 size={16} strokeWidth={1.75} aria-hidden />
              {t("remove")}
            </Button>
          )}
        </div>
        {error && <p className={s.error} role="alert">{error}</p>}
      </div>
    </div>
  );
}

export default function ProfileSection({ email, fullName, avatarUrl, phone, countries, gender }: ProfileProps) {
  const t = useTranslations("account.page.profile");
  const genders = useTranslations("event.guest.genders");
  const { toast } = useToast();
  const router = useRouter();
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, undefined);
  const [name, setName] = useState(fullName);
  const lastSave = useRef<number | null>(null);

  useEffect(() => {
    if (state?.ok && lastSave.current !== state.at) {
      lastSave.current = state.at;
      toast({ title: t("saved"), tone: "success" });
      void refreshSession();
      router.refresh();
    }
  }, [state, t, toast, router]);

  const fieldError = (f: "fullName" | "phone" | "gender") => (state && !state.ok ? state.fields[f] : undefined);
  return (
    <Card as="section" aria-labelledby="account-profile" className={s.section}>
      <CardHeader title={<span id="account-profile">{t("title")}</span>} />
      <AvatarPicker name={name.trim() || email.split("@")[0] || ""} initialUrl={avatarUrl} />
      <form action={action} className={s.form} noValidate>
        <Field label={t("name")} error={fieldError("fullName")} required>
          <Input name="fullName" value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} autoComplete="name" />
        </Field>
        <Field label={t("email")} hint={t("emailHint")}>
          <Input value={email} readOnly dir="ltr" type="email" autoComplete="email" />
        </Field>
        <div className={s.phone}>
          <Field label={t("phoneCountry")}>
            <Select name="phoneCountry" defaultValue={phone.country} autoComplete="tel-country-code">
              {countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label={t("phone")} hint={t("phoneHint")} error={fieldError("phone")}>
            <Input name="phone" type="tel" inputMode="tel" autoComplete="tel-national" maxLength={40} defaultValue={phone.national} placeholder={t("phonePlaceholder")} dir="ltr" />
          </Field>
        </div>
        <Field label={t("gender")} error={fieldError("gender")}>
          <Select name="gender" defaultValue={gender ?? ""}>
            {gender === null && <option value="">{t("genderNone")}</option>}
            <option value="female">{genders("female")}</option>
            <option value="male">{genders("male")}</option>
            <option value="unspecified">{genders("unspecified")}</option>
          </Select>
        </Field>
        <div className={s.footer}>
          {state && !state.ok && <Banner tone="danger" title={state.message} />}
          <Button type="submit" variant="primary" loading={pending}>{pending ? t("saving") : t("save")}</Button>
        </div>
      </form>
    </Card>
  );
}
