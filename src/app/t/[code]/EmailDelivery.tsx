import { sendTicketByEmail } from "./delivery-actions";

// The delivery screen on the ticket page. Shows the masked address the ticket
// was registered with, asks the guest to confirm it, and offers a retry if the
// last attempt failed. A plain form, so it works without JavaScript.
const MESSAGES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  sent: { tone: "ok", text: "Your ticket is on its way. Check your inbox and spam folder in a minute." },
  failed: { tone: "warn", text: "We couldn't send the email. Please try again." },
  confirm: { tone: "warn", text: "Tick the box to confirm your email address first." },
  limit: { tone: "warn", text: "This ticket has been emailed several times this hour. Please try again later." },
  unavailable: { tone: "warn", text: "Email delivery isn't available for this ticket right now." },
};

export default function EmailDelivery({
  code,
  maskedEmail,
  last,
  state,
}: {
  code: string;
  maskedEmail: string;
  last: { status: "sent" | "failed" | null } | null;
  state?: string;
}) {
  const message = state ? MESSAGES[state] : undefined;
  const failedBefore = last?.status === "failed";

  return (
    <section className="tk-wa" aria-label="Email my ticket">
      <p><b>Get your ticket by email</b> We&apos;ll send it to {maskedEmail}, the address you registered with.</p>
      {message && (
        <p className={message.tone === "ok" ? "tk-ok" : "tk-wa-error"} role={message.tone === "ok" ? "status" : "alert"}>
          {message.text}
        </p>
      )}
      {!message && failedBefore && (
        <p className="tk-wa-error" role="status">Your last email didn&apos;t go through.</p>
      )}
      <form action={sendTicketByEmail} className="tk-mail-form">
        <input type="hidden" name="code" value={code} />
        <label className="tk-mail-confirm">
          <input type="checkbox" name="confirm" value="yes" required />
          <span>This is my email address</span>
        </label>
        <button type="submit" className="tk-btn tk-go">
          {failedBefore ? "Try again" : "Email my ticket"}
        </button>
      </form>
    </section>
  );
}
