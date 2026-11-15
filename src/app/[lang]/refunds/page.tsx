import Link from "next/link";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import LegalDoc, { type LegalSection } from "@/components/LegalDoc";
import { withAlternates } from "@/i18n/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("legal.refunds");
  return withAlternates(params, "/refunds", { title: t("metaTitle") });
}

// Each section: [id, paragraphs, bullets, paragraphs after the bullets]. The text is in legal.json
// as legal.refunds.sections.{id}.{title, p1.., b1.., a1..}.
const SECTIONS: [string, number, number, number][] = [
  ["overview", 3, 0, 0],
  ["eventSpecificRefundPolicies", 2, 6, 2],
  ["attendeeInitiatedRefundRequests", 3, 0, 0],
  ["cancelledEvents", 3, 0, 0],
  ["postponedOrRescheduledEvents", 2, 0, 0],
  ["duplicateOrIncorrectPayments", 3, 0, 0],
  ["processingRefunds", 3, 0, 0],
  ["platformAndProcessingFees", 2, 0, 0],
  ["subscriptionRefunds", 2, 0, 0],
  ["fraudAndUnauthorizedTransactions", 3, 0, 0],
  ["howToRequestARefund", 4, 0, 0],
  ["policyUpdates", 1, 0, 0],
  ["contact", 2, 0, 0],
];

const EFFECTIVE = new Date("2026-10-15T12:00:00Z");

export default async function RefundsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("legal");
  const format = await getFormatter();
  const list = (id: string, prefix: string, n: number) => Array.from({ length: n }, (_, i) => t(`refunds.sections.${id}.${prefix}${i + 1}`));
  const sections: LegalSection[] = SECTIONS.map(([id, p, b, a]) => ({
    title: t(`refunds.sections.${id}.title`),
    paragraphs: list(id, "p", p),
    ...(b ? { bullets: list(id, "b", b) } : {}),
    ...(a ? { after: list(id, "a", a) } : {}),
  }));
  const effective = format.dateTime(EFFECTIVE, { year: "numeric", month: "long", day: "numeric", timeZone: "Africa/Lagos" });
  return (
    <LegalDoc title={t("refunds.title")} effective={effective} sections={sections}
      notice={lang !== "en" ? t.rich("notice", { link: (c) => <Link href="/refunds" hrefLang="en">{c}</Link> }) : undefined} />
  );
}
