import { useTranslations } from "next-intl";
import type { PageQuestion } from "@/lib/event-page";

// The part of an order form after the ticket picker, shared by free and paid orders: the buyer's
// name, the account email tickets go to, optional names for the other tickets, the event's questions.
export default function GuestDetails({ idPrefix, total, questions, userEmail, defaultName }: { idPrefix: string; total: number; questions: PageQuestion[]; userEmail: string; defaultName: string }) {
  const t = useTranslations("event.guest");
  const noteId = `${idPrefix}-email-note`;
  return (
    <>
      <label className="field"><span>{t("name")}</span>
        <input className="input" name="buyer_name" defaultValue={defaultName} minLength={2} maxLength={120} autoComplete="name" required={!defaultName} /></label>
      <label className="field"><span>{t("email")}</span>
        <input className="input" type="email" value={userEmail} readOnly aria-describedby={noteId} />
        <small id={noteId} className="muted">{t("emailNote")}</small></label>

      {total > 1 && (
        <fieldset className="form" style={{ gap: 8, border: 0 }}>
          <legend className="muted small">{t("othersLegend")}</legend>
          {Array.from({ length: total - 1 }, (_, i) => (
            <label className="field" key={i}><span>{t("ticketNumber", { number: i + 2 })}</span>
              <input className="input" name={`guest_${i + 2}`} maxLength={120} placeholder={t("namePlaceholder")} /></label>
          ))}
        </fieldset>
      )}

      {questions.map((q) => (
        <label className="field" key={q.id}>
          {q.kind !== "terms" && <span>{q.label}{q.required ? " *" : ""}</span>}
          {q.kind === "options" ? (
            <select className="input" name={`q_${q.id}`} required={q.required} defaultValue="">
              <option value="" disabled>{t("choose")}</option>
              {q.options.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : q.kind === "terms" ? (
            <span className="check"><input type="checkbox" name={`q_${q.id}`} required={q.required} /> <span>{q.label}{q.required ? " *" : ""}</span></span>
          ) : (
            <input className="input" name={`q_${q.id}`} maxLength={1000}
              type={q.kind === "phone" ? "tel" : q.kind === "website" ? "url" : "text"}
              required={q.required} placeholder={q.kind === "social" ? t("socialPlaceholder") : ""} />
          )}
        </label>
      ))}
    </>
  );
}
