export const THEMES: Record<string, { label: string; background: string }> = {
  minimal: { label: "Minimal", background: "linear-gradient(160deg,#2a2a2e,#1e1e1f)" },
  sunset: { label: "Sunset", background: "linear-gradient(160deg,#e0438f,#f0604f 50%,#f2a33a)" },
  ocean: { label: "Ocean", background: "linear-gradient(160deg,#1d3b4d,#2f6f7e 55%,#6aa8f2)" },
  forest: { label: "Forest", background: "linear-gradient(160deg,#1f3d2b,#2f7d5e 55%,#3fb8a8)" },
  night: { label: "Night", background: "linear-gradient(160deg,#0c0c14,#3b1f5c 60%,#9b6cf2)" },
  ember: { label: "Ember", background: "linear-gradient(160deg,#5a2a12,#c4572f 55%,#f2a33a)" },
};

export function themeBackground(key: string | null | undefined) {
  return (THEMES[key ?? "minimal"] ?? THEMES.minimal).background;
}
