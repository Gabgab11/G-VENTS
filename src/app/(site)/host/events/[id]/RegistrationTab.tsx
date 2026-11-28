import { api, data } from "@/lib/api/server";
import { can, type EventDashboard } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { Badge, Button, Card, CardHeader, Checkbox, Field, Input, Link, Select, Textarea } from "@/design";
import { addQuestion, deleteQuestion } from "./actions";
import RegistrationLinks from "./RegistrationLinks";
import styles from "./workspace.module.css";

// Question kinds, in the order the form offers them (labels: dashboard.registration.kinds.*).
const KINDS = ["text", "options", "social", "company", "terms", "phone", "website"];

// Registration questions from the event dashboard (gventz-api); changed through the API.
export default async function RegistrationTab({ event, url }: { event: EventDashboard; url: string }) {
  const id = event.id;
  const manage = can(event, "questions.manage");
  const manageLinks = can(event, "links.manage");
  const t = await getTranslations("dashboard.registration");
  const kindLabel = (kind: string) => (KINDS.includes(kind) ? t(`kinds.${kind}`) : kind);
  // Registration links (Change 6) are managed by the owner and co-hosts; the list is API-gated too.
  const links = manageLinks
    ? data(await (await api()).GET("/v1/events/{id}/registration-links", { params: { path: { id } } })).items
    : [];
  return (
    <div className={styles.stack}>
      {manageLinks && (
        <RegistrationLinks
          eventId={id}
          eventUrl={url}
          links={links}
          ticketTypes={event.ticketTypes.map((tt) => ({ id: tt.id, name: tt.name }))}
        />
      )}

      <Card as="section">
        <CardHeader title={t("guestsFillIn")} />
        <ul className={styles.rows}>
          <li className={styles.listRow}><strong>{t("name")}</strong><Badge tone="neutral" plain>{t("required")}</Badge></li>
          <li className={styles.listRow}><strong>{t("email")}</strong><span className={styles.muted}>{t("accountEmail")}</span></li>
          <li className={styles.listRow}><strong>{t("tickets")}</strong><span className={styles.muted}>{t("perPerson", { count: event.perBuyerLimit })}</span></li>
          {event.questions.map((q) => (
            <li className={styles.listRow} key={q.id}>
              <span className={styles.listMain}>
                <strong>{q.label}</strong>
                <span className={styles.muted}>{kindLabel(q.kind)}{q.kind === "options" ? `: ${q.options.join(", ")}` : ""}</span>
              </span>
              <span className={styles.listSide}>
                <Badge tone="neutral" plain>{t(q.required ? "required" : "optional")}</Badge>
                {manage && (
                  <form action={deleteQuestion}>
                    <input type="hidden" name="event_id" value={id} />
                    <input type="hidden" name="question_id" value={q.id} />
                    <Button size="sm" variant="ghost" type="submit" aria-label={t("removeLabel", { label: q.label })}>{t("remove")}</Button>
                  </form>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {manage && (
        <Card as="section">
          <CardHeader title={t("addTitle")} />
          <form action={addQuestion} className={styles.form}>
            <input type="hidden" name="event_id" value={id} />
            <Field label={t("question")}>
              <Input name="label" maxLength={200} placeholder={t("questionPlaceholder")} /></Field>
            <Field label={t("type")}>
              <Select name="kind" defaultValue="text">
                {KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
              </Select></Field>
            <Field label={t("options")}>
              <Textarea name="options" rows={3} placeholder={t("optionsPlaceholder")} /></Field>
            <Checkbox name="required" label={t("required")} />
            <Button variant="primary" type="submit">{t("add")}</Button>
          </form>
        </Card>
      )}

      <p className={styles.muted}>{t.rich("eventLink", { url, link: (c) => <Link href={url}>{c}</Link> })}</p>
    </div>
  );
}
