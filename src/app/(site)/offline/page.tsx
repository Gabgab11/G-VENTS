import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.offline");
  return { title: t("metaTitle"), robots: { index: false } };
}

// Shown by the service worker (public/sw.js) when a page can't load without a connection.
export default async function OfflinePage() {
  const t = await getTranslations("auth.offline");
  return (
    <main className="offline">
      <div className="offline-card">
        <p className="si-eyebrow">{t("eyebrow")}</p>
        <h1 className="si-title">{t("title")}</h1>
        <p className="si-sub">{t("sub")}</p>
        <Link href="/my-tickets" className="si-primary offline-btn">{t("retry")}</Link>
      </div>
    </main>
  );
}
