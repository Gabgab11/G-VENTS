"use client";

import { useEffect, useState } from "react";
import { applyColorMode, savedColorMode, type ColorMode } from "@/lib/color-mode";

const LABEL: Record<ColorMode, string> = { light: "Light", dark: "Dark", system: "System" };

function Icon({ mode }: { mode: ColorMode }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (mode === "light") return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
  if (mode === "dark") return <svg {...common}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>;
  return <svg {...common}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>;
}

// Light / dark / system switch. System follows the device preference unless a mode is saved.
export default function ColorModeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<ColorMode>("system");
  useEffect(() => setMode(savedColorMode()), []);
  const [systemDark, setSystemDark] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(preference.matches);
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);
  return (
    <div
      className={`cm ${expanded ? "cm-expanded" : "cm-collapsed"} ${className}`}
      role="group"
      aria-label="Colour mode"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false);
      }}
    >
      {(!expanded ? [mode] : ["light", "dark", "system"] as const).map((nextMode) => (
        <button
          key={nextMode}
          type="button"
          className={mode === nextMode ? "on" : ""}
          aria-label={`${LABEL[nextMode]} mode${nextMode === "system" ? (systemDark ? ", currently dark" : ", currently light") : ""}`}
          aria-pressed={mode === nextMode}
          title={`${LABEL[nextMode]} mode`}
          onClick={() => {
            applyColorMode(nextMode);
            setMode(nextMode);
            document.querySelectorAll<HTMLElement>(".hp").forEach((page) => {
              if (nextMode === "system") delete page.dataset.colorMode;
              else page.dataset.colorMode = nextMode;
            });
          }}
        >
          <Icon mode={nextMode} />
        </button>
      ))}
    </div>
  );
}
