import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./home-ball.css";
import { COLOR_MODE_SCRIPT } from "@/lib/color-mode";
import ServiceWorker from "@/components/ServiceWorker";

// Self-hosted from a pinned package, like the fonts in ./fonts.ts (no Google request at build time).
const manrope = localFont({
  src: "../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "G-vents: events from everywhere",
  description: "Create, sell tickets for, and run events anywhere in the world.",
  applicationName: "G-ventZ",
  // Home-screen app on iPhone: full screen, light status bar text over the dark header.
  appleWebApp: { capable: true, title: "G-ventZ", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the colour-mode script sets data-theme on <html> before React loads.
    <html lang="en" className={manrope.className} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: COLOR_MODE_SCRIPT }} />
      </head>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
