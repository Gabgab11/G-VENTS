"use client";

import { useActionState } from "react";
import { confirmUnsubscribe, type UnsubscribeState } from "./actions";

// A button rather than unsubscribing on page load, so mail scanners that open links don't
// unsubscribe people by accident. (Mail apps' own unsubscribe button posts to /api/unsubscribe.)
export default function UnsubscribeForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<UnsubscribeState, FormData>(confirmUnsubscribe, undefined);

  if (state?.ok) {
    return (
      <>
        <h1 className="auth-title">You&apos;re unsubscribed</h1>
        <p className="muted">You won&apos;t get more announcements about {state.eventTitle}. Your tickets still work.</p>
      </>
    );
  }
  return (
    <form action={action} className="auth-form">
      <h1 className="auth-title">Stop announcements?</h1>
      <p className="muted">You&apos;ll stop getting messages from this event&apos;s host. Your tickets still work, and ticket emails still arrive.</p>
      <input type="hidden" name="token" value={token} />
      {state && !state.ok && (
        <p className="error" role="alert">
          {state.reason === "unknown" ? "This link isn't valid. Use the link from the latest email." : "Something went wrong. Please try again."}
        </p>
      )}
      <button className="auth-primary" type="submit" disabled={pending}>{pending ? "Unsubscribing…" : "Unsubscribe"}</button>
    </form>
  );
}
