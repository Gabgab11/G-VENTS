import { describe, expect, it } from "vitest";
import { emailStepReducer as step, initialEmailStep, resendIn, RESEND_COOLDOWN_MS, type EmailStepEvent, type EmailStepState } from "./email-step";

const run = (events: EmailStepEvent[], from: EmailStepState = initialEmailStep) => events.reduce(step, from);
const T0 = 1_800_000_000_000;

describe("the inline email code (D88)", () => {
  it("signed out: email → sending → code sent", () => {
    const sending = run([{ type: "send" }]);
    expect(sending).toEqual({ step: "email", busy: true, error: null });
    expect(step(sending, { type: "send" })).toBe(sending); // a double click sends once
    expect(run([{ type: "send" }, { type: "sent", email: "ada@x.test", at: T0 }])).toEqual({
      step: "code", email: "ada@x.test", sentAt: T0, attempt: 0, busy: null, error: null, notice: null,
    });
  });

  it("a failed send stays on the email with the message", () => {
    expect(run([{ type: "send" }, { type: "failed", message: "Too many codes" }])).toEqual({ step: "email", busy: false, error: "Too many codes" });
    // The next try clears it.
    expect(run([{ type: "send" }, { type: "failed", message: "x" }, { type: "send" }])).toEqual({ step: "email", busy: true, error: null });
  });

  const sent = run([{ type: "send" }, { type: "sent", email: "ada@x.test", at: T0 }]);

  it("a wrong or expired code shows the message and empties the boxes", () => {
    const wrong = run([{ type: "verify" }, { type: "failed", message: "That code is wrong or has expired." }], sent);
    expect(wrong).toMatchObject({ step: "code", busy: null, error: "That code is wrong or has expired.", attempt: 1 });
    // Too many tries: the same, with the rate-limit message.
    expect(run([{ type: "verify" }, { type: "failed", message: "Too many tries." }], wrong)).toMatchObject({ error: "Too many tries.", attempt: 2 });
  });

  it("success ends in done (only after a check was running)", () => {
    expect(run([{ type: "verify" }, { type: "verified" }], sent)).toEqual({ step: "done", email: "ada@x.test" });
    expect(step(sent, { type: "verified" })).toBe(sent);
    const done = run([{ type: "verify" }, { type: "verified" }], sent);
    expect(step(done, { type: "changeEmail" })).toBe(done);
  });

  it("ignores a second check or a resend while one is running", () => {
    const checking = step(sent, { type: "verify" });
    expect(step(checking, { type: "verify" })).toBe(checking);
    expect(step(checking, { type: "resend" })).toBe(checking);
    expect(step(checking, { type: "changeEmail" })).toBe(checking);
  });

  it("resend: a new code empties the boxes, restarts the cooldown and says so", () => {
    const resent = run([{ type: "resend" }, { type: "sent", email: "ada@x.test", at: T0 + 61_000 }], sent);
    expect(resent).toMatchObject({ step: "code", sentAt: T0 + 61_000, attempt: 1, notice: "resent", error: null });
    // A failed resend keeps the boxes and shows the message.
    expect(run([{ type: "resend" }, { type: "failed", message: "Too many codes" }], sent)).toMatchObject({ attempt: 0, error: "Too many codes", busy: null });
  });

  it("change email goes back to the email field", () => {
    expect(step(sent, { type: "changeEmail" })).toEqual(initialEmailStep);
  });

  it("counts down to the next resend", () => {
    expect(resendIn(sent, T0)).toBe(RESEND_COOLDOWN_MS / 1000);
    expect(resendIn(sent, T0 + 59_001)).toBe(1);
    expect(resendIn(sent, T0 + RESEND_COOLDOWN_MS)).toBe(0);
    expect(resendIn(initialEmailStep, T0)).toBe(0);
  });
});
