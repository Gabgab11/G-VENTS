"use client";

import { useEffect, useRef, useState } from "react";
import { applyColorMode, COLOR_MODES, savedColorMode, type ColorMode } from "@/lib/color-mode";

const LABEL: Record<ColorMode, string> = { light: "Light", dark: "Dark", system: "System" };

function Icon({ mode }: { mode: ColorMode }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (mode === "light") return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
  if (mode === "dark") return <svg {...common}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>;
  return <svg {...common}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>;
}

// Light / dark / system switch, collapsed to the current mode until tapped. The saved choice is
// applied before paint by COLOR_MODE_SCRIPT, so this only reflects and changes it.
export default function ColorModeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<ColorMode>("system");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => setMode(savedColorMode()), []);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (!open) {
    return (
      <div ref={root} className={`cm ${className}`}>
        <button type="button" className="cm-current" aria-label={`Colour mode: ${LABEL[mode]}. Change`} aria-expanded={false} title={`${LABEL[mode]} mode`} onClick={() => setOpen(true)}>
          <Icon mode={mode} />
        </button>
      </div>
    );
  }
  return (
    <div ref={root} className={`cm open ${className}`} role="radiogroup" aria-label="Colour mode">
      {COLOR_MODES.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          aria-label={LABEL[m]}
          title={LABEL[m]}
          className={mode === m ? "on" : ""}
          autoFocus={mode === m}
          onClick={() => {
            applyColorMode(m);
            setMode(m);
            setOpen(false);
          }}
        >
          <Icon mode={m} />
        </button>
      ))}
    </div>
  );
}
