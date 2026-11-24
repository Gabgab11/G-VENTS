"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
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
export default function SearchLauncher({ className, labelClassName, kbdClassName }: { className?: string; labelClassName?: string; kbdClassName?: string }) {
  const t = useTranslations("common.search");
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const [apple, setApple] = useState<boolean | null>(null);

  useEffect(() => {
    setApple(isApplePlatform(typeof navigator === "undefined" ? undefined : navigator));
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isOpenShortcut(e)) return;
      e.preventDefault();
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
        onClick={() => { setUsed(true); setOpen(true); }}
        onPointerEnter={() => void load()}
        onFocus={() => void load()}
      >
        <Search size={18} strokeWidth={1.75} aria-hidden />
        <span className={labelClassName} aria-hidden>{t("label")}</span>
        {shortcut ? <kbd className={kbdClassName} aria-hidden dir="ltr">{shortcut}</kbd> : null}
      </button>
      {used ? <CommandPalette open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
