"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ImageUp, Trash2 } from "lucide-react";
import { Avatar, Button, Card, CardHeader } from "@/design";
import { removeProfileImage } from "./actions";
import s from "./profile.module.css";

// The avatar and cover (FR-32): chosen, previewed at once, uploaded through this site's route
// (/api/me/profile/images), which hands them to storage with the API's signed URL. Same rules as
// event pictures: JPEG, PNG or WebP, up to 5 MB.

const MAX = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
type Kind = "avatar" | "cover";

function ImageSlot({ kind, name, url: initialUrl }: { kind: Kind; name: string; url: string | null }) {
  const t = useTranslations("profile.settings");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const errors = useTranslations("errors");
  const problem = (code: string) =>
    code === "flyer_type" || code === "host.image_type" ? t("imageType")
    : code === "flyer_size" || code === "host.image_size" ? t("imageSize")
    : code === "signed_out" ? t("signedOut")
    : errors.has(code) ? errors(code)
    : t("imageFailed");

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    if (!TYPES.includes(file.type)) return setMessage({ tone: "error", text: t("imageType") });
    if (file.size > MAX) return setMessage({ tone: "error", text: t("imageSize") });
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    const body = new FormData();
    body.set("kind", kind);
    body.set("flyer", file);
    const res = await fetch("/api/me/profile/images", { method: "POST", body, headers: { Accept: "application/json" } }).catch(() => null);
    const reply = (await res?.json().catch(() => null)) as { ok: true; url: string | null } | { ok: false; code: string } | null;
    setBusy(false);
    if (reply?.ok) {
      setUrl(reply.url);
      setPreview(null);
      setMessage({ tone: "ok", text: t("imageSaved") });
      router.refresh();
    } else {
      setPreview(null);
      setMessage({ tone: "error", text: problem(reply && !reply.ok ? reply.code : "failed") });
    }
    if (input.current) input.current.value = "";
  };

  const remove = async () => {
    setBusy(true);
    setMessage(null);
    const result = await removeProfileImage(kind).catch(() => ({ ok: false as const, message: t("imageFailed") }));
    setBusy(false);
    if (result.ok) {
      setUrl(null);
      setMessage({ tone: "ok", text: t("imageRemoved") });
      router.refresh();
    } else setMessage({ tone: "error", text: result.message });
  };

  const shown = preview ?? url;
  const label = kind === "avatar" ? t("avatar") : t("cover");
  const inputId = `profile-${kind}`;
  return (
    <div className={s.slot} data-kind={kind}>
      <div className={s.slotPreview} aria-busy={busy || undefined}>
        {kind === "avatar" ? (
          <Avatar name={name || label} src={shown} size={48} className={s.avatarPreview} />
        ) : (
          <div className={s.coverPreview}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local preview or a storage URL */}
            {shown && <img src={shown} alt="" />}
          </div>
        )}
      </div>
      <div className={s.slotText}>
        <label htmlFor={inputId} className={s.slotLabel}>{label}</label>
        <p className={s.slotHint} id={`${inputId}-hint`}>{kind === "avatar" ? t("avatarHint") : t("coverHint")}</p>
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={TYPES.join(",")}
          className="sr-only"
          aria-describedby={`${inputId}-hint`}
          onChange={(e) => void choose(e.target.files?.[0])}
          disabled={busy}
        />
        <div className={s.slotActions}>
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
        <p className={s.slotMessage} role={message?.tone === "error" ? "alert" : "status"} data-tone={message?.tone}>{message?.text}</p>
      </div>
    </div>
  );
}

export default function ProfileImages({ name, avatarUrl, coverUrl }: { name: string; avatarUrl: string | null; coverUrl: string | null }) {
  const t = useTranslations("profile.settings");
  return (
    <Card as="section" aria-labelledby="profile-pictures" className={s.pictures}>
      <CardHeader title={<span id="profile-pictures">{t("picturesTitle")}</span>} />
      <ImageSlot kind="avatar" name={name} url={avatarUrl} />
      <ImageSlot kind="cover" name={name} url={coverUrl} />
    </Card>
  );
}
