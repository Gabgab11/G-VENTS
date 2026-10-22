import { Bricolage_Grotesque, Inter } from "next/font/google";

// Fonts for the home and ticket pages. next/font serves them from this site
// (no request to Google from the visitor's browser) and preloads them, instead
// of the render-blocking @import the pages used before.
export const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-display",
});

export const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-body",
});

export const pageFonts = `${display.variable} ${body.variable}`;
