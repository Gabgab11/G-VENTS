import { ArrowRight, Banknote, CreditCard, Landmark, MapPin, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/design";
import { withAlternates } from "@/i18n/seo";
import { SUPPORT_EMAIL } from "@/lib/contact";
import styles from "./about.module.css";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("info.about");
  return withAlternates(params, "/about", { title: t("meta.title"), description: t("meta.description") });
}

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;
const GUEST_POINTS = ["find", "book", "ticket", "refund"] as const;
const HOST_POINTS = ["create", "sell", "manage", "team"] as const;
const MONEY_STEPS = [
  { id: "pay", icon: <CreditCard {...ICON} /> },
  { id: "split", icon: <Landmark {...ICON} /> },
  { id: "never", icon: <ShieldCheck {...ICON} /> },
] as const;

// About G-ventZ (Change 4 follow-up, step 5): what it is, for guests and for hosts, how money moves
// (Paystack split payouts: each sale goes to the host's bank; G-ventZ never holds it, D84), where we
// are, and the ways in. Public, per language, indexable.
export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("info.about");
  return (
    <main className={`wrap ${styles.page}`}>
      <SiteHeader />

      <header className={styles.hero}>
        <p className={styles.eyebrow}>{t("eyebrow")}</p>
        <h1 className={styles.title}>
          {t("titleStart")} <span className={styles.highlight}>{t("titleHighlight")}</span>
        </h1>
        <p className={styles.lead}>{t("lead")}</p>
        <div className={styles.actions}>
          <Button href="/discover" variant="primary" size="lg">{t("cta.discover")}</Button>
          <Button href="/host/events/new" variant="secondary" size="lg">{t("cta.host")}</Button>
        </div>
      </header>

      <section className={styles.what} aria-labelledby="about-what">
        <h2 id="about-what" className={styles.h2}>{t("what.title")}</h2>
        <div className={styles.whatText}>
          <p>{t("what.p1")}</p>
          <p>{t("what.p2")}</p>
        </div>
      </section>

      <section className={styles.split} aria-label={t("audiences")}>
        <article className={styles.card}>
          <p className={styles.eyebrow}>{t("guests.label")}</p>
          <h2 className={styles.cardTitle}>{t("guests.title")}</h2>
          <ul className={styles.points}>
            {GUEST_POINTS.map((p) => <li key={p}>{t(`guests.points.${p}`)}</li>)}
          </ul>
          <Button href="/discover" variant="ghost" className={styles.cardLink}>
            {t("cta.discover")}<ArrowRight {...ICON} className={styles.arrow} />
          </Button>
        </article>
        <article className={styles.card}>
          <p className={styles.eyebrow}>{t("hosts.label")}</p>
          <h2 className={styles.cardTitle}>{t("hosts.title")}</h2>
          <ul className={styles.points}>
            {HOST_POINTS.map((p) => <li key={p}>{t(`hosts.points.${p}`)}</li>)}
          </ul>
          <Button href="/pricing" variant="ghost" className={styles.cardLink}>
            {t("cta.pricing")}<ArrowRight {...ICON} className={styles.arrow} />
          </Button>
        </article>
      </section>

      <section className={styles.money} aria-labelledby="about-money">
        <div className={styles.moneyHead}>
          <span className={styles.moneyIcon}><Banknote {...ICON} /></span>
          <h2 id="about-money" className={styles.h2}>{t("money.title")}</h2>
          <p className={styles.muted}>{t("money.text")}</p>
        </div>
        <ol className={styles.steps}>
          {MONEY_STEPS.map((s, i) => (
            <li key={s.id} className={styles.step}>
              <span className={styles.stepTop}>
                <span className={styles.stepNumber} aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                <span className={styles.stepIcon}>{s.icon}</span>
              </span>
              <strong>{t(`money.steps.${s.id}.title`)}</strong>
              <p>{t(`money.steps.${s.id}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.where} aria-labelledby="about-where">
        <span className={styles.moneyIcon}><MapPin {...ICON} /></span>
        <div>
          <h2 id="about-where" className={styles.h2}>{t("where.title")}</h2>
          <p className={styles.muted}>
            {t.rich("where.text", { email: () => <a href={`mailto:${SUPPORT_EMAIL}`} className={styles.mail} dir="ltr">{SUPPORT_EMAIL}</a> })}
          </p>
        </div>
      </section>

      <section className={styles.closing} aria-labelledby="about-cta">
        <h2 id="about-cta" className={styles.closingTitle}>{t("closing.title")}</h2>
        <p className={styles.muted}>{t("closing.text")}</p>
        <div className={styles.actions}>
          <Button href="/discover" variant="primary">{t("cta.discover")}</Button>
          <Button href="/host/events/new" variant="secondary">{t("cta.host")}</Button>
          <Button href="/help#contact" variant="ghost">{t("cta.contact")}</Button>
        </div>
      </section>
    </main>
  );
}
