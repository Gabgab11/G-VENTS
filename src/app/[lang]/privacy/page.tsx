import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import LegalDoc, { type LegalSection } from "@/components/LegalDoc";
import { withAlternates } from "@/i18n/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("legal.privacy");
  return withAlternates(params, "/privacy", { title: t("metaTitle") });
}

// PLACEHOLDER: section outline only. Replace each "To be written" paragraph (legal.privacy.toBeWritten)
// with the reviewed policy text and set the effective date before paid tickets launch.
// Each section: [id, has its own first paragraph, bullets]. Text: legal.privacy.sections.{id}.{title, p1, b1..}.
const SECTIONS: [string, boolean, number][] = [
  ["introduction", true, 0],
  ["informationWeCollect", false, 6],
  ["howWeUseYourInformation", false, 0],
  ["sharingWithEventHosts", false, 0],
  ["thirdPartyServices", false, 0],
  ["cookiesAndLocalStorage", false, 0],
  ["dataRetention", false, 0],
  ["yourRights", false, 0],
  ["security", false, 0],
  ["children", false, 0],
  ["changesToThisPolicy", false, 0],
  ["contactUs", false, 0],
];

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("legal");
  const todo = t("privacy.toBeWritten");
  const sections: LegalSection[] = SECTIONS.map(([id, p1, b]) => ({
    title: t(`privacy.sections.${id}.title`),
    paragraphs: p1 ? [t(`privacy.sections.${id}.p1`), todo] : [todo],
    ...(b ? { bullets: Array.from({ length: b }, (_, i) => t(`privacy.sections.${id}.b${i + 1}`)) } : {}),
  }));
  return (
    <LegalDoc title={t("privacy.title")} effective={t("privacy.effective")} intro={t("privacy.intro")} sections={sections}
      notice={lang !== "en" ? t.rich("notice", { link: (c) => <Link href="/privacy" hrefLang="en">{c}</Link> }) : undefined} />
  );
}
