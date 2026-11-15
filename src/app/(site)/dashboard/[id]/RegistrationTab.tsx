import { can, type EventDashboard } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { addQuestion, deleteQuestion } from "./actions";

// Question kinds, in the order the form offers them (labels: dashboard.registration.kinds.*).
const KINDS = ["text", "options", "social", "company", "terms", "phone", "website"];

// Registration questions from the event dashboard (gventz-api); changed through the API.
export default async function RegistrationTab({ event, url }: { event: EventDashboard; url: string }) {
  const id = event.id;
  const manage = can(event, "questions.manage");
  const t = await getTranslations("dashboard.registration");
  const kindLabel = (kind: string) => (KINDS.includes(kind) ? t(`kinds.${kind}`) : kind);
  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-label">{t("guestsFillIn")}</div>
        <div className="q-row"><b>{t("name")}</b><span className="muted small">{t("required")}</span></div>
        <div className="q-row"><b>{t("email")}</b><span className="muted small">{t("accountEmail")}</span></div>
        <div className="q-row"><b>{t("tickets")}</b><span className="muted small">{t("perPerson", { count: event.perBuyerLimit })}</span></div>
        {event.questions.map((q) => (
          <div className="q-row" key={q.id}>
            <span><b>{q.label}</b> <span className="muted small">· {kindLabel(q.kind)}{q.kind === "options" ? `: ${q.options.join(", ")}` : ""}</span></span>
            <span className="q-actions">
              <span className="muted small">{t(q.required ? "required" : "optional")}</span>
              {manage && (
                <form action={deleteQuestion}>
                  <input type="hidden" name="event_id" value={id} />
                  <input type="hidden" name="question_id" value={q.id} />
                  <button className="link-btn" type="submit" aria-label={t("removeLabel", { label: q.label })}>{t("remove")}</button>
                </form>
              )}
            </span>
          </div>
        ))}
      </section>

      {manage && (
        <section className="panel">
          <div className="panel-label">{t("addTitle")}</div>
          <form action={addQuestion} className="form">
            <input type="hidden" name="event_id" value={id} />
            <label className="field"><span>{t("question")}</span>
              <input className="input" name="label" maxLength={200} placeholder={t("questionPlaceholder")} /></label>
            <label className="field"><span>{t("type")}</span>
              <select className="input" name="kind" defaultValue="text">
                {KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
              </select></label>
            <label className="field"><span>{t("options")}</span>
              <textarea className="input" name="options" rows={3} placeholder={t("optionsPlaceholder")} /></label>
            <label className="check"><input type="checkbox" name="required" /> <span>{t("required")}</span></label>
            <button className="btn-white" type="submit">{t("add")}</button>
          </form>
        </section>
      )}

      <p className="muted small">{t.rich("eventLink", { url, link: (c) => <span className="gold">{c}</span> })}</p>
    </div>
  );
}
