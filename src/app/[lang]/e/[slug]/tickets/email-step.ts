// The inline email code on the booking page (Change 4 chunk 3d, D88): a signed-out buyer types their
// email, we send the sign-in code, they type it there and then, and the form continues. Pure, so
// every state is unit-tested; EmailCodeStep.tsx turns it into fields and buttons.

/** Supabase lets an address ask for a new code about once a minute. */
export const RESEND_COOLDOWN_MS = 60_000;

export type EmailStepState =
  /** Typing the email; `busy` while the code is being sent. */
  | { step: "email"; busy: boolean; error: string | null }
  /**
   * The code was sent to `email` at `sentAt`. `attempt` changes whenever the code boxes must start
   * empty again (a wrong code, a new code). `notice` says a new code went out.
   */
  | { step: "code"; email: string; sentAt: number; attempt: number; busy: "verifying" | "resending" | null; error: string | null; notice: "resent" | null }
  /** Signed in: the page refreshes and shows the account email. */
  | { step: "done"; email: string };

export type EmailStepEvent =
  | { type: "send" }
  | { type: "sent"; email: string; at: number }
  | { type: "resend" }
  | { type: "verify" }
  | { type: "verified" }
  | { type: "failed"; message: string }
  | { type: "changeEmail" };

export const initialEmailStep: EmailStepState = { step: "email", busy: false, error: null };

export function emailStepReducer(state: EmailStepState, event: EmailStepEvent): EmailStepState {
  switch (state.step) {
    case "email":
      switch (event.type) {
        case "send":
          return state.busy ? state : { step: "email", busy: true, error: null };
        case "sent":
          return { step: "code", email: event.email, sentAt: event.at, attempt: 0, busy: null, error: null, notice: null };
        case "failed":
          return { step: "email", busy: false, error: event.message };
        default:
          return state;
      }
    case "code":
      switch (event.type) {
        case "verify":
          return state.busy ? state : { ...state, busy: "verifying", error: null, notice: null };
        case "verified":
          return state.busy === "verifying" ? { step: "done", email: state.email } : state;
        case "resend":
          return state.busy ? state : { ...state, busy: "resending", error: null, notice: null };
        case "sent":
          // A new code: empty boxes, a fresh cooldown.
          return { ...state, sentAt: event.at, attempt: state.attempt + 1, busy: null, error: null, notice: "resent" };
        case "failed":
          // A wrong or expired code empties the boxes; a failed resend keeps what was typed.
          return { ...state, attempt: state.busy === "verifying" ? state.attempt + 1 : state.attempt, busy: null, error: event.message };
        case "changeEmail":
          return state.busy ? state : initialEmailStep;
        default:
          return state;
      }
    case "done":
      return state;
  }
}

/** Whole seconds until "Resend code" works again (0 when it does). */
export function resendIn(state: EmailStepState, now: number): number {
  if (state.step !== "code") return 0;
  return Math.max(0, Math.ceil((state.sentAt + RESEND_COOLDOWN_MS - now) / 1000));
}
