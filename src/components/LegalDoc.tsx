import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import SiteHeader from "@/components/SiteHeader";

export type LegalSection = { title: string; paragraphs?: string[]; bullets?: string[]; after?: string[] };

// Shared layout for the Terms and Refund pages. Works on phones: single column, readable text size.
export default function LegalDoc({
  title, effective, intro, sections, notice,
}: { title: string; effective: string; intro?: string; sections: LegalSection[]; notice?: ReactNode }) {
  const t = useTranslations("shared.legalDoc");
  return (
    <main className="wrap page legal">
      <SiteHeader />
      <h1>{title}</h1>
      <p className="meta">{t("effective", { date: effective })}</p>
      {/* Translated pages: the English version is the one that applies (Change 3, legal pages). */}
      {notice && <p className="meta" role="note">{notice}</p>}
      {intro && <p>{intro}</p>}
      {sections.map((s, i) => (
        <section key={s.title}>
          <h2>{i + 1}. {s.title}</h2>
          {s.paragraphs?.map((p, j) => <p key={j}>{p}</p>)}
          {s.bullets && (
            <ul>
              {s.bullets.map((b, j) => <li key={j}>{b}</li>)}
            </ul>
          )}
          {s.after?.map((p, j) => <p key={`a${j}`}>{p}</p>)}
        </section>
      ))}
      <p className="meta">
        <Link href="/terms">{t("terms")}</Link> · <Link href="/refunds">{t("refunds")}</Link> · <Link href="/pricing">{t("pricing")}</Link> · <Link href="/privacy">{t("privacy")}</Link>
      </p>
    </main>
  );
}
