export type Effect = "none" | "petals" | "fireflies" | "sparks" | "stars" | "waves";

export type Theme = {
  label: string;
  background: string;   // cover artwork
  bg: string;           // whole page background
  surface: string;      // cards
  surfaceHi: string;    // raised elements
  line: string;         // borders
  text: string;
  muted: string;
  grad: string;         // accent gradient
  effect: Effect;       // motion layer unique to each style
  accents: string[];    // colours used by the motion layer
};

export const THEMES: Record<string, Theme> = {
  minimal: {
    label: "Minimal",
    background: "linear-gradient(160deg,#2a2a2e,#1e1e1f)",
    bg: "#141414", surface: "#1e1e1f", surfaceHi: "#262628", line: "#2c2c2e",
    text: "#ffffff", muted: "#9a9a9f",
    grad: "linear-gradient(90deg,#e0438f,#f0604f 50%,#f2a33a)",
    effect: "none", accents: ["#ffffff"],
  },
  sunset: {
    label: "Sunset",
    background: "linear-gradient(160deg,#e0438f,#f0604f 50%,#f2a33a)",
    bg: "#fcefe6", surface: "#fff8f2", surfaceHi: "#f7dfcf", line: "#efcdb8",
    text: "#2b1a12", muted: "#8a5f4e",
    grad: "linear-gradient(90deg,#e0438f,#f0604f 50%,#f2a33a)",
    effect: "petals", accents: ["#e0438f", "#f0604f", "#f2a33a", "#f7b7a3"],
  },
  ocean: {
    label: "Ocean",
    background: "linear-gradient(160deg,#1d3b4d,#2f6f7e 55%,#6aa8f2)",
    bg: "#0c1d29", surface: "#122a39", surfaceHi: "#1a3a4d", line: "#22475b",
    text: "#eaf6ff", muted: "#8fb3c4",
    grad: "linear-gradient(90deg,#3fb8a8,#6aa8f2)",
    effect: "waves", accents: ["#3fb8a8", "#6aa8f2", "#9fd8ff"],
  },
  forest: {
    label: "Forest",
    background: "linear-gradient(160deg,#1f3d2b,#2f7d5e 55%,#3fb8a8)",
    bg: "#0d1d15", surface: "#14281e", surfaceHi: "#1c3a2b", line: "#244a39",
    text: "#eefaf3", muted: "#9cc4ae",
    grad: "linear-gradient(90deg,#3fb8a8,#c7d158)",
    effect: "fireflies", accents: ["#c7d158", "#f2e27a", "#8ff2b6"],
  },
  night: {
    label: "Night",
    background: "linear-gradient(160deg,#0c0c14,#3b1f5c 60%,#9b6cf2)",
    bg: "#0d0a18", surface: "#171229", surfaceHi: "#241c40", line: "#332856",
    text: "#f4f0ff", muted: "#aaa0cc",
    grad: "linear-gradient(90deg,#9b6cf2,#e0438f)",
    effect: "stars", accents: ["#ffffff", "#cbb8ff", "#ffd6ea"],
  },
  ember: {
    label: "Ember",
    background: "linear-gradient(160deg,#5a2a12,#c4572f 55%,#f2a33a)",
    bg: "#1b100a", surface: "#281911", surfaceHi: "#37241a", line: "#4a3123",
    text: "#fff4ec", muted: "#c9a894",
    grad: "linear-gradient(90deg,#f0604f,#f2a33a)",
    effect: "sparks", accents: ["#f2a33a", "#f0604f", "#ffd27a"],
  },
};

export function themeBackground(key: string | null | undefined) {
  return (THEMES[key ?? "minimal"] ?? THEMES.minimal).background;
}
