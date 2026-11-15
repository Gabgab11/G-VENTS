import { getTranslations, setRequestLocale } from "next-intl/server";
import PricingPlans from "@/components/PricingPlans";
import { withAlternates } from "@/i18n/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("info");
  return withAlternates(params, "/pricing", { title: t("pricing.meta.title") });
}

export default async function PricingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  return <PricingPlans />;
}
