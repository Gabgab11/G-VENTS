import Link from "next/link";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import LegalDoc, { type LegalSection } from "@/components/LegalDoc";
import { withAlternates } from "@/i18n/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("legal.terms");
  return withAlternates(params, "/terms", { title: t("metaTitle") });
}

// Each section: [id, paragraphs, bullets, paragraphs after the bullets]. The text is in legal.json
// as legal.terms.sections.{id}.{title, p1.., b1.., a1..}.
const SECTIONS: [string, number, number, number][] = [
  ["introduction", 4, 0, 0],
  ["eligibilityAndAccounts", 2, 5, 1],
  ["eventOrganizers", 2, 7, 1],
  ["attendeesAndTicketPurchases", 4, 0, 0],
  ["platformFeesAndPayments", 6, 0, 0],
  ["payouts", 4, 0, 0],
  ["cancellationsAndRefunds", 6, 0, 0],
  ["prohibitedActivities", 1, 9, 1],
  ["intellectualProperty", 4, 0, 0],
  ["privacy", 3, 0, 0],
  ["thirdPartyServices", 3, 0, 0],
  ["serviceAvailability", 3, 0, 0],
  ["limitationOfLiability", 3, 0, 0],
  ["accountSuspensionAndTermination", 4, 0, 0],
  ["changesToTheseTerms", 3, 0, 0],
  ["governingLaw", 2, 0, 0],
  ["contact", 3, 0, 0],
];

const EFFECTIVE = new Date("2026-10-15T12:00:00Z");

export default async function TermsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("legal");
  const format = await getFormatter();
  const list = (id: string, prefix: string, n: number) => Array.from({ length: n }, (_, i) => t(`terms.sections.${id}.${prefix}${i + 1}`));
  const sections: LegalSection[] = SECTIONS.map(([id, p, b, a]) => ({
    title: t(`terms.sections.${id}.title`),
    paragraphs: list(id, "p", p),
    ...(b ? { bullets: list(id, "b", b) } : {}),
    ...(a ? { after: list(id, "a", a) } : {}),
  }));
  const effective = format.dateTime(EFFECTIVE, { year: "numeric", month: "long", day: "numeric", timeZone: "Africa/Lagos" });
  return (
    <LegalDoc title={t("terms.title")} effective={effective} sections={sections}
      notice={lang !== "en" ? t.rich("notice", { link: (c) => <Link href="/terms" hrefLang="en">{c}</Link> }) : undefined} />
  );
}
