import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/components/SiteHeader";
import { withAlternates } from "@/i18n/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("info");
  return withAlternates(params, "/help", { title: t("help.meta.title") });
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("info");
  return (
    <main className="wrap page">
      <SiteHeader />
      <h1>{t("help.title")}</h1>
      <p className="muted">{t("help.text")}</p>
    </main>
  );
}
