// Keyboard shortcuts that open the command palette (FR-34): ⌘K on Apple devices, Ctrl+K elsewhere,
// and "/" when the visitor isn't typing somewhere.

type KeyLike = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "isComposing"> & { target: EventTarget | null };

/** Whether focus is in a place where "/" is text (a field, a select, an editable region). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== "string") return false;
  const el = target as HTMLElement;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable === true;
}

export function isOpenShortcut(e: KeyLike): boolean {
  if (e.isComposing || e.altKey) return false;
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "k") return true;
  return e.key === "/" && !e.metaKey && !e.ctrlKey && !isTypingTarget(e.target);
}

/** Apple keyboards show ⌘; everyone else Ctrl. */
export function isApplePlatform(nav: { platform?: string; userAgent?: string } | undefined): boolean {
  const p = `${nav?.platform ?? ""} ${nav?.userAgent ?? ""}`;
  return /Mac|iPhone|iPad|iPod/i.test(p);
}
