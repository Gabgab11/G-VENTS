import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "@/design/tokens.css";
import "./globals.css";
import "./home-ball.css";
import { COLOR_MODE_SCRIPT } from "@/lib/color-mode";
import ServiceWorker from "@/components/ServiceWorker";
import AuthFloor from "@/components/AuthFloor";
import { LANGUAGE_INFO, dirOf, type Locale } from "@/i18n/languages";
import { display } from "./fonts";

// The document both root layouts share (Change 3, I2): public pages ([lang]) and the rest ((site))
// each have a root layout so public pages can stay static per language, but render this same shell.
// `lang` and `dir` follow the page's language (FR-22.4); Chinese and Arabic text falls back to the
// system's own fonts (globals.css :lang rules), so no extra font files are downloaded.

// Self-hosted from a pinned package, like the fonts in ./fonts.ts (no Google request at build time).
const manrope = localFont({
  src: "../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-sans-face",
});

export const baseMetadata: Metadata = {
  title: "G-vents: events from everywhere",
  description: "Create, sell tickets for, and run events anywhere in the world.",
  applicationName: "G-ventZ",
  // Home-screen app on iPhone: full screen, light status bar text over the dark header.
  appleWebApp: { capable: true, title: "G-ventZ", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const baseViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
  ],
};

export default function RootShell({ lang, children }: { lang: Locale; children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the colour-mode script sets data-theme on <html> before React loads.
    <html lang={LANGUAGE_INFO[lang].hreflang} dir={dirOf(lang)} className={`${manrope.className} ${manrope.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: COLOR_MODE_SCRIPT }} />
      </head>
      <body>
        {children}
        <ServiceWorker />
        <AuthFloor />
      </body>
    </html>
  );
}
