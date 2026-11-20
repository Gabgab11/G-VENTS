"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { DRAFT_EVENT, draftFromEntries, draftKey, readDraft, type BookingDraft, type DraftCommand } from "./booking-draft";

/** Asks every booking form on the page to save (before sign-in) or drop (sign-in failed) its draft. */
export function broadcastDraft(command: DraftCommand) {
  window.dispatchEvent(new CustomEvent<DraftCommand>(DRAFT_EVENT, { detail: command }));
}

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

type Options = {
  form: RefObject<HTMLFormElement | null>;
  eventId: string;
  kind: "free" | "paid";
  signedIn: boolean;
  /** Restores the quantities (and the paid form's code) kept in React state. */
  restore: (draft: BookingDraft) => void;
  /** The discount code to keep with the draft (paid form). */
  code?: string;
  /** Runs once the restored fields are back in the form (re-check its validity). */
  restored?: () => void;
};

/**
 * Keeps the buyer's input across the refresh after the inline email code (D88). The form saves a
 * draft when asked; a form that mounts with a draft puts it back and drops it. A form that stays
 * mounted through the refresh keeps its own state, so its draft is dropped once it sees the sign-in.
 * Returns `clear`, for the form's submit.
 */
export function useBookingDraft({ form, eventId, kind, signedIn, restore, code, restored }: Options) {
  const key = draftKey(eventId, kind);
  const latest = useRef({ restore, code, restored });
  latest.current = { restore, code, restored };
  const pending = useRef<Record<string, string> | null>(null);
  const [tick, setTick] = useState(0);

  // Save or drop on request.
  useEffect(() => {
    const onCommand = (e: Event) => {
      const store = storage();
      if (!store) return;
      const command = (e as CustomEvent<DraftCommand>).detail;
      try {
        if (command === "clear" || !form.current) return store.removeItem(key);
        const draft = draftFromEntries(new FormData(form.current).entries(), Date.now(), latest.current.code);
        store.setItem(key, JSON.stringify(draft));
      } catch {
        // Storage full or blocked: the form simply starts empty after a remount.
      }
    };
    window.addEventListener(DRAFT_EVENT, onCommand);
    return () => window.removeEventListener(DRAFT_EVENT, onCommand);
  }, [form, key]);

  // On mount: put a draft back (quantities first, so the guest-name fields exist), then drop it.
  useEffect(() => {
    const store = storage();
    let draft: BookingDraft | null = null;
    try {
      draft = readDraft(store?.getItem(key) ?? null, Date.now());
      store?.removeItem(key);
    } catch {
      return;
    }
    if (!draft) return;
    latest.current.restore(draft);
    pending.current = draft.fields;
    setTick((n) => n + 1);
  }, [key]);

  // After the restored quantities have rendered, fill the uncontrolled fields.
  useEffect(() => {
    const fields = pending.current;
    const el = form.current;
    if (!tick || !fields || !el) return;
    pending.current = null;
    for (const control of Array.from(el.elements)) {
      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) continue;
      const name = control.name;
      if (!name || name.startsWith("qty_") || (control instanceof HTMLInputElement && control.type === "hidden")) continue;
      if (control instanceof HTMLInputElement && control.type === "checkbox") control.checked = fields[name] === "on";
      else if (control instanceof HTMLInputElement && control.type === "radio") continue; // kept in React state (restore)
      else if (name in fields) control.value = fields[name]!;
    }
    latest.current.restored?.();
  }, [form, tick]);

  // Stayed mounted through the sign-in: the state is intact, so the draft isn't needed.
  const wasSignedIn = useRef(signedIn);
  useEffect(() => {
    if (signedIn && !wasSignedIn.current) {
      try {
        storage()?.removeItem(key);
      } catch {
        // ignore
      }
    }
    wasSignedIn.current = signedIn;
  }, [signedIn, key]);

  return {
    clear() {
      try {
        storage()?.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}
