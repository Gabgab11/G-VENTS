"use client";

import jsQR from "jsqr";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/languages";
import { scanTicket } from "./actions";
import { scanScreen, type ScanScreen } from "./scan-screen";
import { Button, Input } from "@/design";

const SCAN_EVERY_MS = 150;
const SHOW_RESULT_MS = 1_500;
const SAME_CODE_PAUSE_MS = 3_000;

// The door scanner (US-8.1): the phone's back camera, QR decoding in the browser with jsQR (works
// on iPhone Safari, unlike BarcodeDetector), one server call per new code, a full-screen answer.
export default function Scanner({ eventId, title }: { eventId: string; title: string }) {
  const t = useTranslations("dashboard.scan");
  const lang = useLocale() as Locale;
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const busy = useRef(false);
  const last = useRef<{ code: string; at: number } | null>(null);
  const [screen, setScreen] = useState<ScanScreen | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [manual, setManual] = useState("");
  const [count, setCount] = useState(0);

  const submit = useCallback(
    async (code: string) => {
      if (busy.current) return;
      const now = Date.now();
      if (last.current && last.current.code === code && now - last.current.at < SAME_CODE_PAUSE_MS) return;
      busy.current = true;
      last.current = { code, at: now };
      const res = await scanTicket(eventId, code);
      const shown = res.scan ? scanScreen(res.scan, t, lang) : { tone: "red" as const, title: t("couldntCheck"), detail: res.error ?? "" };
      if (res.scan?.result === "green") setCount((n) => n + 1);
      setScreen(shown);
      if ("vibrate" in navigator) navigator.vibrate(shown.tone === "green" ? 80 : [60, 60, 60]);
      setTimeout(() => {
        setScreen(null);
        busy.current = false;
      }, SHOW_RESULT_MS);
    },
    [eventId, t, lang],
  );

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        timer = setInterval(() => {
          const v = video.current;
          const c = canvas.current;
          if (!v || !c || busy.current || v.readyState < 2) return;
          const w = v.videoWidth;
          const h = v.videoHeight;
          if (!w || !h) return;
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(v, 0, 0, w, h);
          const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
          if (found?.data) void submit(found.data);
        }, SCAN_EVERY_MS);
      } catch {
        setCameraError(true);
      }
    })();
    return () => {
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [submit]);

  return (
    <div className="scanner">
      <p className="muted small">{title} · {t("deviceCount", { count })}</p>
      <div className="scanner-view">
        <video ref={video} playsInline muted className="scanner-video" aria-label={t("cameraPreview")} />
        <canvas ref={canvas} hidden />
        {cameraError && <p className="error">{t("cameraError")}</p>}
        {screen && (
          <div className={`scan-result ${screen.tone}`} role="alert" aria-live="assertive">
            <b>{screen.title}</b>
            <span>{screen.detail}</span>
          </div>
        )}
      </div>
      <form
        className="scanner-manual"
        onSubmit={(e) => {
          e.preventDefault();
          const code = manual.replace(/\s+/g, "");
          if (code) void submit(code);
          setManual("");
        }}
      >
        <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder={t("codePlaceholder")} aria-label={t("codeLabel")} autoComplete="off" />
        <Button size="sm" type="submit">{t("check")}</Button>
      </form>
    </div>
  );
}
