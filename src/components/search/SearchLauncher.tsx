"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { isApplePlatform, isOpenShortcut } from "./shortcut";

// The palette's code is fetched on first open (or when the pointer or focus reaches the button),
// so pages pay only for this button and the shortcut listener (NFR-18: first-load JS within +6 KB).
const load = () => import("./CommandPalette");
const CommandPalette = dynamic(load, { ssr: false });

/**
 * The header's search pill (FR-34): "Search ⌘K" on wide screens, an icon on phones. ⌘K / Ctrl+K
 * and "/" open the palette from anywhere on the page.
 */
/** Remembers what had focus (not something inside a dialog, e.g. ⌘K pressed in the palette itself). */
function focusedOutsideDialogs(): HTMLElement | null {
  const el = document.activeElement;
  return el instanceof HTMLElement && !el.closest("[role=dialog]") ? el : null;
}

export default function SearchLauncher({ className, labelClassName, kbdClassName }: { className?: string; labelClassName?: string; kbdClassName?: string }) {
  const t = useTranslations("common.search");
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const [apple, setApple] = useState<boolean | null>(null);
  // Where focus goes back to when the palette closes: whatever had it when it opened.
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setApple(isApplePlatform(typeof navigator === "undefined" ? undefined : navigator));
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isOpenShortcut(e)) return;
      e.preventDefault();
      returnTo.current = focusedOutsideDialogs() ?? returnTo.current;
      setUsed(true);
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shortcut = apple === null ? null : apple ? "⌘K" : "Ctrl K";
  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={t("open")}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K /"
        onClick={() => { returnTo.current = focusedOutsideDialogs(); setUsed(true); setOpen(true); }}
        onPointerEnter={() => void load()}
        onFocus={() => void load()}
      >
        <Search size={18} strokeWidth={1.75} aria-hidden />
        <span className={labelClassName} aria-hidden>{t("label")}</span>
        {shortcut ? <kbd className={kbdClassName} aria-hidden dir="ltr">{shortcut}</kbd> : null}
      </button>
      {used ? <CommandPalette open={open} onOpenChange={setOpen} returnFocus={() => returnTo.current} /> : null}
    </>
  );
}
