"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { setLanguage } from "@/i18n/actions";
import { LANGUAGE_INFO, enabledLanguages, type Locale } from "@/i18n/languages";

// The language menu in the header and footer (W7, FR-23.2): each language in its own name. Hidden
// while only English is switched on (D76), so nothing changes for visitors until release.
export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const t = useTranslations("common.language");
  const current = useLocale() as Locale;
  const languages = enabledLanguages();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = (e: Event) => {
      const el = menu.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", close); };
  }, []);

  if (languages.length < 2) return null;

  function choose(lang: Locale) {
    if (menu.current) menu.current.open = false;
    if (lang === current) return;
    // Read at click time (not useSearchParams), so static pages stay static.
    const query = window.location.search.replace(/^\?/, "");
    start(async () => {
      const result = await setLanguage(lang, `${pathname}${query ? `?${query}` : ""}`);
      if ("redirectTo" in result) {
        // A different root layout (another language's page) needs a full load; same address: refresh.
        if (result.redirectTo !== `${pathname}${query ? `?${query}` : ""}`) window.location.assign(result.redirectTo);
        else router.refresh();
      }
    });
  }

  return (
    <details className={`lang-menu ${className}`} ref={menu} data-testid="language-switcher">
      <summary aria-label={t("current", { name: LANGUAGE_INFO[current].name })} aria-busy={pending || undefined} data-testid="language-switcher-toggle">
        <span aria-hidden>🌐</span> <span className="lang-code">{LANGUAGE_INFO[current].prefix.toUpperCase() || "EN"}</span>
      </summary>
      <ul className="lang-list" role="list" aria-label={t("choose")}>
        {languages.map((lang) => (
          <li key={lang}>
            <button type="button" lang={LANGUAGE_INFO[lang].hreflang} dir={LANGUAGE_INFO[lang].dir} aria-current={lang === current ? "true" : undefined}
              onClick={() => choose(lang)} data-testid={`language-switcher-option-${lang}`}>
              {LANGUAGE_INFO[lang].name}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
