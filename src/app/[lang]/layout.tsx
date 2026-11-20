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
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((lang) => ({ lang }));
}

export default async function PublicLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
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
