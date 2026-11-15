"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

// Shown when a page fails to load, for example if the database is unreachable.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("shared.errorPage");
  useEffect(() => {
    // Lands in the Vercel function/browser logs; swap for an error-monitoring SDK when one is added.
    console.error(error);
  }, [error]);

  return (
    <main className="wrap page">
      <h1>{t("title")}</h1>
      <p className="muted">{t("body")}</p>
      {error.digest && <p className="muted small">{t("reference", { digest: error.digest })}</p>}
      <div className="actions">
        <button type="button" className="btn-white" onClick={reset}>{t("retry")}</button>
        <Link href="/" className="btn-ghost">{t("home")}</Link>
      </div>
    </main>
  );
}
