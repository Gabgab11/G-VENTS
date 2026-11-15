import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import RootShell, { baseMetadata, baseViewport } from "@/app/RootShell";
import type { Locale } from "@/i18n/languages";

// Addresses that match no page at all (with two root layouts there is no shared not-found). The
// language is the one the middleware chose for this request (cookie, browser, else English).
export const viewport = baseViewport;

export async function generateMetadata() {
  const t = await getTranslations("shared.notFound");
  return { ...baseMetadata, title: `${t("title")} · G-ventZ` };
}

export default async function GlobalNotFound() {
  const lang = (await getLocale()) as Locale;
  const t = await getTranslations("shared.notFound");
  return (
    <RootShell lang={lang}>
      <main className="wrap page">
        <h1>{t("title")}</h1>
        <p className="muted">{t("body")}</p>
        <div className="actions">
          <Link href="/discover" className="btn-white">{t("discover")}</Link>
          <Link href="/" className="btn-ghost">{t("home")}</Link>
        </div>
      </main>
    </RootShell>
  );
}
