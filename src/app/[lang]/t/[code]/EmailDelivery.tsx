import { getTranslations } from "next-intl/server";
import { sendTicketByEmail } from "./delivery-actions";

// The delivery screen on the ticket page. Shows the masked address the ticket
// was registered with, asks the guest to confirm it, and offers a retry if the
// last attempt failed. A plain form, so it works without JavaScript.
// Message ids under tickets.email.
const MESSAGES: Record<string, { tone: "ok" | "warn"; id: string }> = {
  sent: { tone: "ok", id: "sent" },
  failed: { tone: "warn", id: "failed" },
  confirm: { tone: "warn", id: "confirmFirst" },
  limit: { tone: "warn", id: "limit" },
  unavailable: { tone: "warn", id: "unavailable" },
};

export default async function EmailDelivery({
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
  const t = await getTranslations("tickets.email");
  const found = state && Object.hasOwn(MESSAGES, state) ? MESSAGES[state] : undefined;
  const message = found ? { tone: found.tone, text: t(found.id) } : undefined;
  const failedBefore = last?.status === "failed";

  return (
    <section className="tk-wa" aria-label={t("label")}>
      <p>{t.rich("intro", { b: (c) => <b>{c}</b>, email: maskedEmail })}</p>
      {message && (
        <p className={message.tone === "ok" ? "tk-ok" : "tk-wa-error"} role={message.tone === "ok" ? "status" : "alert"}>
          {message.text}
        </p>
      )}
      {!message && failedBefore && (
        <p className="tk-wa-error" role="status">{t("lastFailed")}</p>
      )}
      <form action={sendTicketByEmail} className="tk-mail-form">
        <input type="hidden" name="code" value={code} />
        <label className="tk-mail-confirm">
          <input type="checkbox" name="confirm" value="yes" required />
          <span>{t("confirm")}</span>
        </label>
        <button type="submit" className="tk-btn tk-go">
          {failedBefore ? t("tryAgain") : t("send")}
        </button>
      </form>
    </section>
  );
}
