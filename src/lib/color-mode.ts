// Light, dark or system (FR design C3). The choice lives in localStorage; "system" means no
// data-theme attribute, so the CSS follows prefers-color-scheme.

export type ColorMode = "light" | "dark" | "system";
export const COLOR_MODE_KEY = "gventz-color-mode";
export const COLOR_MODES: readonly ColorMode[] = ["light", "dark", "system"];

export function isColorMode(value: unknown): value is ColorMode {
  return value === "light" || value === "dark" || value === "system";
}

/** Runs in <head> before the page paints, so a saved choice never flashes the other theme. */
export const COLOR_MODE_SCRIPT = `(function(){try{var m=localStorage.getItem("${COLOR_MODE_KEY}");if(m==="light"||m==="dark")document.documentElement.setAttribute("data-theme",m);}catch(e){}})();`;

export function applyColorMode(mode: ColorMode): void {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
  try {
    localStorage.setItem(COLOR_MODE_KEY, mode);
  } catch {
    // Private mode or blocked storage: the choice still applies to this page.
  }
}

export function savedColorMode(): ColorMode {
  try {
    const value = localStorage.getItem(COLOR_MODE_KEY);
    return isColorMode(value) ? value : "system";
  } catch {
    return "system";
  }
}
