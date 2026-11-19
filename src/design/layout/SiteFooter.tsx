import Link from "next/link";
import { getTranslations } from "next-intl/server";
import FooterWordmark from "@/app/FooterWordmark";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import SocialLinks from "@/components/SocialLinks";
import "./site-footer.css";

// The one site footer (Change 4, DS4): the big wordmark, link columns, social links, language and the
// legal links. Always dark (data-theme="dark" fixes its tokens), whatever theme the page is in.
export default async function SiteFooter() {
  const t = await getTranslations("home");
  return (
    <footer className="site-footer" data-theme="dark">
      <FooterWordmark />
      <div className="site-footer-main">
        <div className="site-footer-brand">
          <Link href="/" className="site-footer-logo">G-vent<b>Z</b></Link>
          <p>{t("footer.tagline")}</p>
        </div>
        <div>
          <p className="site-footer-title">{t("footer.discover.title")}</p>
          <nav className="site-footer-links" aria-label={t("footer.discover.title")}>
            <Link href="/discover">{t("footer.discover.allEvents")}</Link>
            <Link href="/pricing">{t("footer.discover.pricing")}</Link>
            <Link href="/events/new">{t("footer.discover.createEvent")}</Link>
          </nav>
        </div>
        <div>
          <p className="site-footer-title">{t("footer.hosts.title")}</p>
          <nav className="site-footer-links" aria-label={t("footer.hosts.title")}>
            <Link href="/events/new">{t("footer.hosts.host")}</Link>
            <Link href="/help">{t("footer.hosts.help")}</Link>
            <Link href="/refunds">{t("footer.hosts.refunds")}</Link>
          </nav>
        </div>
        <div>
          <p className="site-footer-title">{t("footer.company.title")}</p>
          <nav className="site-footer-links" aria-label={t("footer.company.title")}>
            <Link href="/help">{t("footer.company.about")}</Link>
            <Link href="/help">{t("footer.company.contact")}</Link>
          </nav>
        </div>
        <div>
          <p className="site-footer-title">{t("footer.contact.title")}</p>
          <div className="site-footer-contact">
            <p className="site-footer-label">{t("footer.contact.support")}</p>
            <Link href="/help">{t("footer.contact.visitHelp")}</Link>
          </div>
          <div className="site-footer-contact">
            <p className="site-footer-label">{t("footer.contact.forHosts")}</p>
            <Link href="/events/new">{t("footer.contact.getStarted")}</Link>
          </div>
        </div>
      </div>
      <div className="site-footer-bottom">
        <div className="site-footer-meta">
          <p>{`© ${new Date().getFullYear()} G-ventZ`}</p>
          <SocialLinks />
          <LanguageSwitcher className="lang-menu-up" />
        </div>
        <nav className="site-footer-legal" aria-label={t("footer.legal.label")}>
          <Link href="/terms">{t("footer.legal.terms")}</Link>
          <Link href="/privacy">{t("footer.legal.privacy")}</Link>
        </nav>
      </div>
    </footer>
  );
}
