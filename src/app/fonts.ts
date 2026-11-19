import localFont from "next/font/local";

// The display face (logo and headlines), read through --font-display in src/design/tokens.css.
// next/font serves it from this site (no request to Google from the visitor's browser) and preloads them, instead
// of the render-blocking @import the pages used before.
// The files come from pinned @fontsource-variable packages (OFL-1.1), not from Google at build
// time: next/font/google fetched Google's CSS on every build, and an unexpected answer failed the
// build at random (issue #41). Latin subset, variable weight; Bricolage also has its opsz axis.
export const display = localFont({
  src: "../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-display-face",
});

// Inter was removed in Change 4 (D80): the interface is Manrope everywhere (RootShell).
export const pageFonts = display.variable;
