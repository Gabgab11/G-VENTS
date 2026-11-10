import localFont from "next/font/local";

// Fonts for the home and ticket pages. next/font serves them from this site
// (no request to Google from the visitor's browser) and preloads them, instead
// of the render-blocking @import the pages used before.
// The files come from pinned @fontsource-variable packages (OFL-1.1), not from Google at build
// time: next/font/google fetched Google's CSS on every build, and an unexpected answer failed the
// build at random (issue #41). Latin subset, variable weight; Bricolage also has its opsz axis.
export const display = localFont({
  src: "../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-display",
});

export const body = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-body",
});

export const pageFonts = `${display.variable} ${body.variable}`;
