import { api, data } from "@/lib/api/server";
import { can, type EventDashboard } from "@/lib/auth";
import { getLocale, getTranslations } from "next-intl/server";
import { createAnnouncement, sendAnnouncement } from "./actions";
import { intlLocale } from "@/lib/format";
import type { Locale } from "@/i18n/languages";
import { Megaphone } from "lucide-react";
import { Badge, Banner, Button, Card, CardHeader, EmptyState, Field, Input, Select, Textarea } from "@/design";
import styles from "./workspace.module.css";

// Segment → its label's id under dashboard.announcements.segments.
const SEGMENT_LABELS = {
  all: "all",
  paid: "paid",
  checked_in: "checkedIn",
  not_checked_in: "notCheckedIn",
  waitlist: "waitlist",
} as const;

const resetDate = (iso: string, lang: Locale) => new Intl.DateTimeFormat(intlLocale(lang, "date"), { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(iso));

// Announcements through gventz-api: save a draft, then send it (C2). The free plan allows 2 sends
// per event, before it starts, and 1,000 announcement emails a month per host; the API enforces
// both and this tab shows what's left.
export default async function AnnouncementsTab({ event }: { event: EventDashboard }) {
  const id = event.id;
  const [t, lang] = await Promise.all([getTranslations("dashboard.announcements"), getLocale() as Promise<Locale>]);
  const segmentLabel = (segment: string) => (Object.hasOwn(SEGMENT_LABELS, segment) ? t(`segments.${SEGMENT_LABELS[segment as keyof typeof SEGMENT_LABELS]}`) : undefined);
  const client = await api();
  const [past, allowance] = await Promise.all([
    client.GET("/v1/events/{id}/announcements", { params: { path: { id } } }).then(data),
    client.GET("/v1/events/{id}/announcements/allowance", { params: { path: { id } } }).then(data),
  ]);
  const canSend = can(event, "announcements.send");
  const sendsLeft = Math.max(0, allowance.sendsAllowed - allowance.sendsUsed);
  const emailsLeft = Math.max(0, allowance.emailsAllowed - allowance.emailsUsed);
  const started = new Date(event.startsAt).getTime() <= Date.now();

  return (
    <div className={styles.stack}>
      <Card as="section">
        <CardHeader title={t("plan")} />
        <ul className={styles.rows}>
          <li className={styles.listRow}>
            <span className={styles.listMain}><strong>{t("sendsLabel")}</strong><span className={styles.muted}>{t("sendsContext")}</span></span>
            <strong>{t("leftOf", { left: sendsLeft, allowed: allowance.sendsAllowed })}</strong>
          </li>
          <li className={styles.listRow}>
            <span className={styles.listMain}><strong>{t("emailsLabel")}</strong><span className={styles.muted}>{t("resets", { date: resetDate(allowance.periodEndsAt, lang) })}</span></span>
            <strong>{t("leftOf", { left: emailsLeft, allowed: allowance.emailsAllowed })}</strong>
          </li>
        </ul>
        <p className={styles.muted}>{t("countRule")}</p>
        {started && <Banner tone="info" title={t("started")} />}
      </Card>

      {can(event, "announcements.draft") && (
        <Card as="section">
          <CardHeader title={t("newTitle")} />
          <form action={createAnnouncement} className={styles.form}>
            <input type="hidden" name="event_id" value={id} />
            <Field label={t("sendTo")}>
              <Select name="segment" defaultValue="all">
                {(Object.keys(SEGMENT_LABELS) as (keyof typeof SEGMENT_LABELS)[]).map((key) => (
                  <option key={key} value={key}>{segmentLabel(key)} ({allowance.audience[key]})</option>
                ))}
              </Select></Field>
            <Field label={t("subject")}>
              <Input name="subject" maxLength={200} placeholder={t("subjectPlaceholder")} /></Field>
            <Field label={t("message")}>
              <Textarea name="body" rows={6} placeholder={t("messagePlaceholder")} /></Field>
            <Button variant="primary" type="submit">{t("saveDraft")}</Button>
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
              const audience = allowance.audience[a.segment as keyof typeof SEGMENT_LABELS] ?? 0;
              return (
                <li className={styles.listRow} key={a.id}>
                  <span className={styles.listMain}>
                    <strong>{a.subject}</strong>
                    <span className={styles.muted}>{segmentLabel(a.segment) ?? a.segment}</span>
                  </span>
                  <span className={styles.listSide}>
                    {a.status === "draft" ? (
                      canSend && !started && sendsLeft > 0 ? (
                        <form action={sendAnnouncement}>
                          <input type="hidden" name="event_id" value={id} />
                          <input type="hidden" name="announcement_id" value={a.id} />
                          <Button variant="primary" size="sm" type="submit" disabled={audience === 0}>
                            {t("send", { count: audience })}
                          </Button>
                        </form>
                      ) : (
                        <Badge tone="neutral">{t("draft")}</Badge>
                      )
                    ) : (
                      <>
                        <Badge tone={a.status === "sent" ? "success" : "info"}>{t(a.status === "sent" ? "sent" : "sending")}</Badge>
                        <span className={styles.muted}>{t("emailed", { sent: a.sentCount, total: a.recipientCount })}</span>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
