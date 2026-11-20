"use client";

import { AtSign, Copy, Mail, MessageCircle, QrCode, Share2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/design";
import { Sheet, SheetContent, ToastProvider, useToast, type ToastOptions } from "@/design/client";
import { shareUrls, withRef } from "@/lib/share";
import styles from "./ShareButton.module.css";

export type ShareButtonProps = {
  /** The page's own path, with its language prefix (e.g. "/fr/e/slug"). */
  path: string;
  title: string;
  text?: string;
  /** The share card (1200×630) shown as a preview in the sheet. */
  cardUrl?: string;
  variant?: "button" | "icon";
  /** Text on the QR poster. */
  qr?: { title: string; subtitle: string };
};

// Network names are product names and stay as they are; everything else is translated.
const NETWORKS = [
  { key: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
  { key: "x", label: "X", Icon: AtSign },
  { key: "facebook", label: "Facebook", Icon: Users },
] as const;

const icon = (Icon: typeof Share2) => <Icon size={20} strokeWidth={1.75} aria-hidden />;

/**
 * Share an event (FR-29.2). Phones and tablets get the system share sheet; elsewhere (or when the
 * system sheet fails) a Sheet with the card preview, share links, Copy link and a QR poster. The
 * shared link is this page's address plus `?ref=share`.
 */
export default function ShareButton(props: ShareButtonProps) {
  const t = useTranslations("shared.share");
  const toast = useRef<Toast>(() => {});
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  // No ToastProvider is mounted site-wide yet, so the button brings its own for "Link copied". It is
  // portalled to <body>: inside the page (a stacking context) it would sit under the open sheet.
  return (
    <>
      <ShareControl {...props} toast={(o) => toast.current(o)} />
      {host
        ? createPortal(
            <div className={styles.toasts}>
              <ToastProvider closeLabel={t("close")}>
                <ToastBridge into={toast} />
              </ToastProvider>
            </div>,
            host,
          )
        : null}
    </>
  );
}

type Toast = (options: ToastOptions) => void;

/** Hands the portalled provider's `toast` to the button. */
function ToastBridge({ into }: { into: RefObject<Toast> }) {
  const { toast } = useToast();
  useEffect(() => {
    into.current = toast;
  }, [into, toast]);
  return null;
}

function ShareControl({ path, title, text, cardUrl, variant = "button", qr, toast }: ShareButtonProps & { toast: Toast }) {
  const t = useTranslations("shared.share");
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function share() {
    const link = withRef(`${window.location.origin}${path}`);
    setUrl(link);
    const data = { title, text: text ?? title, url: link };
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    if (coarse && typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(data))) {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return; // the visitor closed the system sheet
      }
    }
    setOpen(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: t("copied"), tone: "success" });
    } catch {
      input.current?.focus();
      input.current?.select();
      toast({ title: t("copyManual"), tone: "info" });
    }
  }

  async function poster() {
    setBusy(true);
    try {
      const { drawPoster } = await import("./share-poster");
      const blob = await drawPoster(url, qr ?? { title, subtitle: "" }, t("posterScan"));
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${slugOf(path)}-qr.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch (error) {
      console.error(`[share] poster: ${(error as Error).message}`);
      toast({ title: t("posterFailed"), tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  const links = url ? shareUrls(url, title) : null;
  const external = { target: "_blank", rel: "noopener noreferrer" } as const;

  return (
    <>
      {variant === "icon" ? (
        <Button icon={icon(Share2)} aria-label={t("share")} onClick={share} />
      ) : (
        <Button variant="secondary" onClick={share}>{icon(Share2)}{t("share")}</Button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title={t("title")} closeLabel={t("close")}>
          <div className={styles.body}>
            {cardUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a generated card, not an optimisable asset
              <img src={cardUrl} alt={t("preview")} width={1200} height={630} loading="lazy" className={styles.card} />
            ) : null}
            {links ? (
              <div className={styles.networks}>
                {NETWORKS.map(({ key, label, Icon }) => (
                  <Button key={key} href={links[key]} {...external}>{icon(Icon)}{label}</Button>
                ))}
                <Button href={links.email} {...external}>{icon(Mail)}{t("email")}</Button>
              </div>
            ) : null}
            <div className={styles.copyRow}>
              <input
                ref={input}
                className={styles.link}
                value={url}
                readOnly
                aria-label={t("linkLabel")}
                onFocus={(e) => e.currentTarget.select()}
                dir="ltr"
              />
              <Button variant="primary" onClick={copy}>{icon(Copy)}{t("copy")}</Button>
            </div>
            <Button onClick={poster} loading={busy} fullWidth>{busy ? null : icon(QrCode)}{t("poster")}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** "/fr/e/my-party" → "my-party". */
function slugOf(path: string): string {
  const last = path.split(/[?#]/)[0]!.split("/").filter(Boolean).pop() ?? "event";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}
