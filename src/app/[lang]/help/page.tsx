import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, CalendarPlus, Mail, ReceiptText, Tag, Ticket } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Globe from "./Globe";
import SiteHeader from "@/components/SiteHeader";
import { withAlternates } from "@/i18n/seo";
import { SUPPORT_EMAIL, contactCountryOptions } from "@/lib/contact";
import ContactForm from "./ContactForm";
import styles from "./help.module.css";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("info");
  return withAlternates(params, "/help", { title: t("help.meta.title"), description: t("help.meta.description") });
}

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;

// Quick help: where most questions are answered already.
const QUICK: { id: string; href: string; icon: ReactNode }[] = [
  { id: "tickets", href: "/my-tickets", icon: <Ticket {...ICON} /> },
  { id: "refunds", href: "/refunds", icon: <ReceiptText {...ICON} /> },
  { id: "pricing", href: "/pricing", icon: <Tag {...ICON} /> },
  { id: "hosting", href: "/host/events/new", icon: <CalendarPlus {...ICON} /> },
];

// Help & contact (Change 4 follow-up, step 4): quick links, then a contact section laid out like
// Mirage's contact page (an intro with numbered notes and a dotted map with Lagos, the form beside it).
export default async function HelpPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("info.help");
  const mail = <a href={`mailto:${SUPPORT_EMAIL}`} className={styles.mail} dir="ltr">{SUPPORT_EMAIL}</a>;
  return (
    <main className={`wrap ${styles.page}`}>
      <SiteHeader />

      <header className={styles.hero}>
        <p className={styles.eyebrow}>{t("eyebrow")}</p>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.lead}>{t("text")}</p>
        <p className={styles.emailLine}>
          <Mail size={20} strokeWidth={1.75} aria-hidden />
          <span>{t.rich("emailUs", { email: () => mail })}</span>
        </p>
      </header>

      <nav className={styles.quick} aria-label={t("quick.label")}>
        {QUICK.map((q) => (
          <Link key={q.id} href={q.href} className={styles.quickCard}>
            <span className={styles.quickIcon}>{q.icon}</span>
            <span className={styles.quickText}>
              <strong>{t(`quick.${q.id}.title`)}</strong>
              <span>{t(`quick.${q.id}.text`)}</span>
            </span>
            <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden className={styles.quickArrow} />
          </Link>
        ))}
      </nav>
      <p className={styles.legalLinks}>
        {t.rich("quick.legalLinks", {
          terms: (c) => <Link href="/terms">{c}</Link>,
          privacy: (c) => <Link href="/privacy">{c}</Link>,
        })}
      </p>

      <section id="contact" className={styles.contact} aria-labelledby="contact-title">
        <aside className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>{t("contact.label")}</p>
            <h2 className={styles.introTitle}>{t("contact.title")}</h2>
            <p className={styles.lead}>{t("contact.text")}</p>
          </div>

          <div className={styles.notes}>
            <article className={styles.note}>
              <span className={styles.noteNumber} aria-hidden>{"01"}</span>
              <div>
                <strong>{t("contact.note1.title")}</strong>
                <p>{t("contact.note1.text")}</p>
              </div>
            </article>
            <article className={styles.note}>
              <span className={styles.noteNumber} aria-hidden>{"02"}</span>
              <div>
                <strong>{t("contact.note2.title")}</strong>
                <p>{t("contact.note2.text")}</p>
              </div>
            </article>
          </div>

          <div>
            <Globe label={t("contact.mapLabel")} stops={[
              { lon: 3.38, lat: 6.52, label: t("contact.pin") },
              { lon: -0.13, lat: 51.51, label: t("contact.cities.london") },
              { lon: -74.0, lat: 40.71, label: t("contact.cities.newYork") },
              { lon: -46.63, lat: -23.55, label: t("contact.cities.saoPaulo") },
              { lon: 18.42, lat: -33.92, label: t("contact.cities.capeTown") },
              { lon: 36.82, lat: -1.29, label: t("contact.cities.nairobi") },
              { lon: 55.27, lat: 25.2, label: t("contact.cities.dubai") },
              { lon: 72.88, lat: 19.08, label: t("contact.cities.mumbai") },
              { lon: 139.69, lat: 35.69, label: t("contact.cities.tokyo") },
              { lon: 151.21, lat: -33.87, label: t("contact.cities.sydney") },
            ]} />
            <p className={styles.caption}>{t("contact.caption")}</p>
          </div>
        </aside>

        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <p className={styles.eyebrow}>{t("contact.panelLabel")}</p>
            <h2 id="contact-title" className={styles.panelTitle}>{t("contact.panelTitle")}</h2>
            <p className={styles.panelText}>{t("contact.panelText")}</p>
          </div>
          <ContactForm countries={contactCountryOptions(lang)} />
        </div>
      </section>
    </main>
  );
}
