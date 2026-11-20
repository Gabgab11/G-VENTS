"use client";

import { useCallback, useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { clampQuantities } from "../event-cta";
import type { BookingDraft } from "./booking-draft";
import { useBookingDraft } from "./use-booking-draft";

type Options = {
  form: RefObject<HTMLFormElement | null>;
  eventId: string;
  kind: "free" | "paid";
  signedIn: boolean;
  perBuyerLimit: number;
  setQty: Dispatch<SetStateAction<Record<string, number>>>;
  /** Re-checks the form's validity (useFormValid). */
  check: () => void;
  /** Paid form: the applied discount code, kept with the draft and put back after a remount. */
  code?: string;
  restoreCode?: (code: string) => void;
};

/**
 * What both order forms need around the inline sign-in (D88): the draft that bridges the refresh,
 * quantities cut to the account's room once it is known, and "Email confirmed" after the code.
 */
export function useCheckout({ form, eventId, kind, signedIn, perBuyerLimit, setQty, check, code, restoreCode }: Options) {
  const [justVerified, setJustVerified] = useState(false);

  const restore = useCallback(
    (draft: BookingDraft) => {
      setQty((q) => clampQuantities(Object.keys(draft.qty).length > 0 ? draft.qty : q, perBuyerLimit));
      if (draft.code) restoreCode?.(draft.code);
      setJustVerified(signedIn);
    },
    [perBuyerLimit, restoreCode, setQty, signedIn],
  );
  const draft = useBookingDraft({ form, eventId, kind, signedIn, restore, code, restored: check });

  // An account that already holds tickets may have less room than a signed-out visitor was offered.
  useEffect(() => {
    setQty((q) => clampQuantities(q, perBuyerLimit));
  }, [perBuyerLimit, setQty]);

  return {
    justVerified,
    /** The inline code signed the buyer in. */
    signedIn: useCallback(() => setJustVerified(true), []),
    /** The order is being sent: the draft is no longer needed. */
    submitted: draft.clear,
  };
}
