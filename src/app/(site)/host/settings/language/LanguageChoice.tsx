"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check } from "lucide-react";
import { setLanguage } from "@/i18n/actions";
import type { Locale } from "@/i18n/languages";
import styles from "../settings.module.css";

/** Each language in its own name; choosing one saves it and reloads the page in it. */
export default function LanguageChoice({ current, options, label }: { current: Locale; options: { code: Locale; name: string }[]; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (code: Locale) => {
    if (code === current) return;
    start(async () => {
      await setLanguage(code, "/host/settings/language");
      router.refresh();
    });
  };
  return (
    <div role="group" aria-label={label} aria-busy={pending || undefined} className={styles.languages}>
      {options.map((o) => (
        <button key={o.code} type="button" lang={o.code} className={styles.theme} aria-pressed={o.code === current} onClick={() => choose(o.code)} disabled={pending}>
          <span>{o.name}</span>
          {o.code === current && <Check size={16} strokeWidth={1.75} aria-hidden className={styles.check} />}
        </button>
      ))}
    </div>
  );
}
