"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Megaphone, Send, Users } from "lucide-react";
import { useFormat } from "@/i18n/format-hooks";
import { intlLocale, safeZone } from "@/lib/format";
import { Badge, Banner, Button, Card, CardHeader, EmptyState, Field, Input, Select, Textarea } from "@/design";
import { Dialog, DialogClose, DialogContent, ToastProvider, useToast } from "@/design/client";
import { saveAnnouncementDraft, sendAnnouncementNow } from "./announce-actions";
import { SEGMENTS, audienceCount, notSent, remaining, sendBlock, type Allowance, type Announcement, type Segment, type TemplateId } from "./announce";
import styles from "./tools.module.css";

type Props = {
  eventId: string;
  eventTitle: string;
  eventUrl: string;
  startsAt: string;
  endsAt: string | null;
  timeZone: string;
  published: boolean;
  started: boolean;
  canDraft: boolean;
  canSend: boolean;
  allowance: Allowance;
  templates: TemplateId[];
  past: Announcement[];
};

// Segment → its label's id under dashboard.announcements.segments.
const SEGMENT_LABELS = { all: "all", paid: "paid", checked_in: "checkedIn", not_checked_in: "notCheckedIn", waitlist: "waitlist" } as const;
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

export default function AnnouncementComposer(props: Props) {
  const t = useTranslations("dashboard");
  return (
    <ToastProvider closeLabel={t("tools.close")}>
      <Composer {...props} />
    </ToastProvider>
  );
}

type Confirm = { id: string | null; segment: Segment; template: TemplateId | null };

function Composer(props: Props) {
  const { eventId, eventTitle, startsAt, endsAt, timeZone, published, started, canDraft, canSend, allowance, templates, past } = props;
  const t = useTranslations("dashboard.announcements");
  const tools = useTranslations("dashboard.tools");
  const format = useFormat();
  const { toast } = useToast();
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [pending, startTransition] = useTransition();
  const left = remaining(allowance);
  const count = audienceCount(allowance, segment);
  const block = sendBlock({ allowance, segment, template, started, published });
  const segmentLabel = (s: string) => (Object.hasOwn(SEGMENT_LABELS, s) ? t(`segments.${SEGMENT_LABELS[s as Segment]}`) : s);
  const n = (x: number) => x.toLocaleString(intlLocale(format.lang));
  const resetDate = new Intl.DateTimeFormat(intlLocale(format.lang, "date"), { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(allowance.periodEndsAt));

  const missing = () => {
    if (!subject.trim()) return { message: t("errors.subject"), field: "subject" };
    if (!body.trim()) return { message: t("errors.body"), field: "body" };
    return null;
  };
  const draft = () => ({ subject, body, segment, template });

  const saveDraft = () => {
    const problem = missing();
    setError(problem);
    if (problem) return;
    startTransition(async () => {
      const r = await saveAnnouncementDraft(eventId, draft());
      if (!r.ok) return setError({ message: r.error, field: r.field });
      toast({ title: t("draftSavedToast"), tone: "success" });
      setSubject("");
      setBody("");
      setTemplate(null);
    });
  };

  const askSend = (e: FormEvent) => {
    e.preventDefault();
    const problem = missing();
    setError(problem);
    if (!problem) setConfirm({ id: null, segment, template });
  };

  const send = () => {
    if (!confirm) return;
    const target = confirm;
    startTransition(async () => {
      const r = await sendAnnouncementNow(eventId, target.id, target.id ? null : draft());
      setConfirm(null);
      if (!r.ok) {
        if (target.id) toast({ title: r.error, tone: "danger" });
        else setError({ message: r.error, field: r.field });
        return;
      }
      toast({ title: t("sentToast", { count: r.data.queued }), tone: "success" });
      if (!target.id) {
        setSubject("");
        setBody("");
        setTemplate(null);
      }
    });
  };

  const confirmCount = confirm ? audienceCount(allowance, confirm.segment) : 0;

  return (
    <div className={styles.stack}>
      <Card as="section">
        <CardHeader title={t("plan")} />
        <div className={styles.allowance}>
          <Meter label={t("sendsLabel")} context={t("sendsContext")} used={allowance.sendsUsed} allowed={allowance.sendsAllowed} value={t("leftOf", { left: n(left.sends), allowed: n(allowance.sendsAllowed) })} />
          <Meter label={t("emailsLabel")} context={t("resets", { date: resetDate })} used={allowance.emailsUsed} allowed={allowance.emailsAllowed} value={t("leftOf", { left: n(left.emails), allowed: n(allowance.emailsAllowed) })} />
        </div>
        <p className={styles.muted}>{t("countRule")}</p>
      </Card>

      {canDraft && (
        <Card as="section">
          <CardHeader title={t("newTitle")} />
          <form className={styles.form} onSubmit={askSend} noValidate>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{t("template")}</legend>
              <div className={styles.choices}>
                {([null, ...templates] as (TemplateId | null)[]).map((id) => (
                  <label key={id ?? "blank"} className={styles.choice}>
                    <input type="radio" name="announcement-template" checked={template === id} onChange={() => setTemplate(id)} />
                    <span className={styles.choiceName}>{t(`templates.${id ?? "blank"}.name`)}</span>
                    <span className={styles.choiceHelp}>{t(`templates.${id ?? "blank"}.help`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label={t("subject")} error={error?.field === "subject" ? error.message : undefined} required>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder={t("subjectPlaceholder")} />
            </Field>
            <Field label={t("message")} hint={template ? t("messageHintTemplate") : undefined} error={error?.field === "body" ? error.message : undefined} required>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={10000} placeholder={t("messagePlaceholder")} />
            </Field>
            <Field label={t("sendTo")}>
              <Select value={segment} onChange={(e) => setSegment(e.target.value as Segment)}>
                {SEGMENTS.map((s) => <option key={s} value={s}>{t("segmentOption", { label: segmentLabel(s), count: audienceCount(allowance, s) })}</option>)}
              </Select>
            </Field>
            <p className={styles.recipients}><Users {...ICON} />{t("recipients", { count })}</p>

            <Preview title={eventTitle} subject={subject} body={body} template={template} startsAt={startsAt} endsAt={endsAt} timeZone={timeZone} />

            {error && !error.field && <Banner tone="danger" title={error.message} />}
            {canSend && block && <Banner tone={block === "empty" ? "info" : "warning"} title={t(`blocks.${block}`)} />}
            <div className={styles.actions}>
              {canSend && (
                <Button variant="primary" type="submit" disabled={block !== null || pending}><Send {...ICON} />{t("sendButton")}</Button>
              )}
              <Button variant="secondary" type="button" onClick={saveDraft} loading={pending && !confirm}>{t("saveDraft")}</Button>
            </div>
            {!canSend && <p className={styles.muted}>{t("draftOnly")}</p>}
          </form>
        </Card>
      )}

      <Card as="section">
        <CardHeader title={t("title")} />
        {past.length === 0 ? (
          <EmptyState icon={<Megaphone size={20} strokeWidth={1.75} aria-hidden />} title={t("none")} />
        ) : (
          <ul className={styles.rows}>
            {past.map((a) => {
              const draftBlock = a.status === "draft" ? sendBlock({ allowance, segment: a.segment, template: a.template, started, published }) : null;
              const failed = notSent(a);
              return (
                <li className={styles.row} key={a.id}>
                  <span className={styles.rowMain}>
                    <strong>{a.subject}</strong>
                    <span className={styles.muted}>
                      {[a.template ? t(`templates.${a.template}.name`) : null, segmentLabel(a.segment), a.sentAt ? t("sentOn", { date: format.dateTime(a.sentAt, timeZone, "compact") }) : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className={styles.rowSide}>
                    {a.status === "draft" ? (
                      <>
                        <Badge tone="neutral">{t("draft")}</Badge>
                        {canSend && (
                          <Button size="sm" variant="primary" disabled={draftBlock !== null || pending} onClick={() => setConfirm({ id: a.id, segment: a.segment, template: a.template })}>
                            {t("send", { count: audienceCount(allowance, a.segment) })}
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Badge tone={a.status === "sent" ? "success" : "info"}>{t(a.status === "sent" ? "sent" : "sending")}</Badge>
                        <span className={styles.muted}>{t("emailed", { sent: a.sentCount, total: a.recipientCount })}</span>
                        {failed > 0 && <Badge tone="warning" plain>{t("notSent", { count: failed })}</Badge>}
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && !pending && setConfirm(null)}>
        {confirm && (
          <DialogContent
            title={t("confirmTitle", { count: confirmCount })}
            description={t("confirmBody", { count: confirmCount, sends: left.sends, emails: left.emails })}
            closeLabel={tools("close")}
            footer={
              <>
                <DialogClose><Button variant="secondary">{tools("cancel")}</Button></DialogClose>
                <Button variant="primary" onClick={send} loading={pending}><Send {...ICON} />{t("confirmSend")}</Button>
              </>
            }
          />
        )}
      </Dialog>
    </div>
  );
}

function Meter({ label, context, used, allowed, value }: { label: string; context: string; used: number; allowed: number; value: string }) {
  const share = allowed > 0 ? Math.min(100, Math.round((used / allowed) * 100)) : 100;
  return (
    <div className={styles.meter}>
      <div className={styles.meterHead}>
        <strong>{label}</strong>
        <strong className={styles.numeric}>{value}</strong>
      </div>
      <span className={styles.meterTrack} aria-hidden><span className={styles.meterFill} style={{ inlineSize: `${share}%` }} /></span>
      <span className={styles.muted}>{context}</span>
    </div>
  );
}

/** The email as a guest receives it, in the host's language (each guest gets their own). */
function Preview({ title, subject, body, template, startsAt, endsAt, timeZone }: { title: string; subject: string; body: string; template: TemplateId | null; startsAt: string; endsAt: string | null; timeZone: string }) {
  const t = useTranslations("dashboard.announcements.preview");
  const format = useFormat();
  const date = new Intl.DateTimeFormat(intlLocale(format.lang, "date"), { weekday: "long", day: "numeric", month: "long", timeZone: safeZone(timeZone) }).format(new Date(startsAt));
  const time = format.range(startsAt, endsAt, timeZone);
  const u = (chunks: ReactNode) => <u>{chunks}</u>;
  return (
    <section className={styles.form} aria-labelledby="announcement-preview">
      <h3 className={styles.legend} id="announcement-preview">{t("title")}</h3>
      <div className={styles.preview}>
        <p className={styles.previewEyebrow}>{t("fromHost", { title })}</p>
        <p className={styles.previewSubject}>{subject.trim() || <span className={styles.previewEmpty}>{t("emptySubject")}</span>}</p>
        {template && <p className={styles.previewLead}>{t(`lead.${template}`, { title, date, time })}</p>}
        {body.trim() ? <p className={styles.previewBody}>{body.trim()}</p> : <p className={styles.previewEmpty}>{t("emptyBody")}</p>}
        <p className={styles.previewFooter}>{t.rich("footer", { title, link: u })}</p>
      </div>
      <p className={styles.muted}>{t("note")}</p>
    </section>
  );
}
