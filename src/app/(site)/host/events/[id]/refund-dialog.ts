// The refund dialog's rules (Change 4 follow-up, step 3), kept pure so they are unit-tested. The
// dialog asks for two-step sign-in first when this session hasn't used it (the API refuses refunds
// with auth.mfa_required until it has), and comes back to the same ticket's dialog afterwards.

export type RefundStatus = "queued" | "processing" | "refunded" | "failed";

/** What the refund action returns to the dialog: it stays open on an error. */
export type RefundResult =
  | { ok: true; status: RefundStatus }
  | { ok: false; error: string; twoStep?: boolean; reason?: string };

/** Which panel the dialog shows. */
export type RefundView = "two_step" | "confirm";

/** The guest list with this ticket's dialog open again (after two-step sign-in). */
export function refundReturnPath(eventId: string, ticketId: string): string {
  return `/host/events/${eventId}?${new URLSearchParams({ tab: "guests", refund: ticketId })}`;
}

/** Two-step sign-in, then back to this ticket's refund dialog. */
export function twoStepHref(eventId: string, ticketId: string): string {
  return `/host/settings/security?next=${encodeURIComponent(refundReturnPath(eventId, ticketId))}`;
}

/** Two-step first unless this session is already at aal2. */
export function initialRefundView(level: "aal1" | "aal2" | null | undefined): RefundView {
  return level === "aal2" ? "confirm" : "two_step";
}

/** Whether this row's dialog opens by itself: the ?refund= ticket on return from two-step sign-in. */
export function opensOnLoad(requested: string | null | undefined, ticketId: string): boolean {
  return typeof requested === "string" && requested.length > 0 && requested === ticketId;
}

/** Whether a guest row offers a refund: a paid, confirmed ticket with money to return and no refund under way. */
export function canRefundRow(row: { paid: boolean; status: string; refundableMinor: number | null; refundStatus: RefundStatus | null }): boolean {
  return row.paid && row.status === "confirmed" && row.refundableMinor !== null && row.refundableMinor > 0 && (!row.refundStatus || row.refundStatus === "failed");
}

export type RefundState = { view: RefundView; confirmed: boolean; error: string | null; reason: string | null };

export type RefundEvent =
  | { type: "confirm"; checked: boolean }
  | { type: "result"; result: RefundResult }
  | { type: "reset"; view: RefundView };

/** The dialog's state after each event: a refused two-step switches to the two-step panel. */
export function refundReducer(state: RefundState, event: RefundEvent): RefundState {
  switch (event.type) {
    case "confirm":
      return { ...state, confirmed: event.checked, error: null, reason: null };
    case "reset":
      return { view: event.view, confirmed: false, error: null, reason: null };
    case "result": {
      const r = event.result;
      if (r.ok) return { ...state, error: null, reason: null };
      if (r.twoStep) return { view: "two_step", confirmed: false, error: null, reason: null };
      return { ...state, error: r.error, reason: r.reason ?? null };
    }
  }
}
