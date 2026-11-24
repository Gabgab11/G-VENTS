import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import SiteFooter from "@/design/layout/SiteFooter";
import FooterGate from "@/design/layout/FooterGate";
import RootShell, { baseMetadata, baseViewport } from "@/app/RootShell";
import LanguageHint from "@/components/LanguageHint";
import { pickAreas, PUBLIC_CLIENT_AREAS } from "@/i18n/messages";
import { routing } from "@/i18n/routing";
import type { Catalogue } from "@/i18n/catalogue";

// Root layout for public pages (home, discover, event and ticket pages, info pages): one static
// copy per switched-on language (FR-24, NFR-10). English is served without a prefix; the middleware
// rewrites it to /en internally.
export const metadata = baseMetadata;
export const viewport = baseViewport;
// true, not false: on Cloudflare (OpenNext) a page missing from the page cache must render on
// demand. With false, every language but English answered 404 whenever its prebuilt copy wasn't in
// R2 (staging, 2026-11-24). Unknown languages still get a 404 from the check below.
export const dynamicParams = true;

export function generateStaticParams() {
  return routing.locales.map((lang) => ({ lang }));
}

export default async function PublicLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) {
    // Set first, so the 404 page reads its language from here and never from request headers,
    // which a static page can't do (that turned the 404 into a 500).
    setRequestLocale(routing.defaultLocale);
    notFound();
  }
  setRequestLocale(lang);
  const messages = (await getMessages()) as Catalogue;
  return (
    <RootShell lang={lang}>
      <NextIntlClientProvider messages={pickAreas(messages, PUBLIC_CLIENT_AREAS)}>
        <LanguageHint />
        {children}
        <FooterGate><SiteFooter /></FooterGate>
      </NextIntlClientProvider>
    </RootShell>
  );
}
