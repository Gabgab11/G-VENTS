"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { setLanguage } from "@/i18n/actions";
import { LANGUAGE_INFO, isEnabled, type Locale } from "@/i18n/languages";
import { Button } from "@/design";

const DISMISSED = "gventz_lang_hint_dismissed";

// "This page is also available in Français" (W8, FR-24.3): shown on an English public page when the
// visitor prefers another switched-on language, instead of redirecting them. Drawn in the browser
// (the page itself is cached and shared), once: "No thanks" is remembered on this device.
export default function LanguageHint() {
  const t = useTranslations("common.language");
  const current = useLocale() as Locale;
  const pathname = usePathname();
  const [preferred, setPreferred] = useState<Locale | null>(null);

  useEffect(() => {
    if (current !== "en") return;
    try {
      if (localStorage.getItem(DISMISSED)) return;
    } catch {
      // Storage blocked: show the hint; dismissing just won't be remembered.
    }
    let live = true;
    fetch("/api/session", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { language?: string }) => { if (live && isEnabled(d.language) && d.language !== current) setPreferred(d.language); })
      .catch(() => {});
    return () => { live = false; };
  }, [current]);

  if (!preferred) return null;
  const name = LANGUAGE_INFO[preferred].name;

  function dismiss() {
    try { localStorage.setItem(DISMISSED, "1"); } catch { /* not remembered */ }
    setPreferred(null);
  }

  async function switchTo() {
    const lang = preferred!;
    const result = await setLanguage(lang, pathname);
    if ("redirectTo" in result) window.location.assign(result.redirectTo);
  }

  return (
    <div className="lang-hint" role="region" aria-label={t("label")} data-testid="language-hint">
      <span lang={LANGUAGE_INFO[preferred].hreflang}>{t("hint", { name })}</span>
      <Button variant="primary" size="sm" onClick={switchTo} data-testid="language-hint-switch">{t("hintSwitch", { name })}</Button>
      <button type="button" className="link-btn" onClick={dismiss} data-testid="language-hint-dismiss">{t("hintDismiss")}</button>
    </div>
  );
}
