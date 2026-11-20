"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { History } from "lucide-react";
import { useFormat } from "@/i18n/format-hooks";
import { Banner, Button, Card, CardHeader, EmptyState, Field, Select } from "@/design";
import { loadActivity } from "./activity-actions";
import { ACTIVITY_KINDS, activityLabelKey, activityValues, appendPage, filterActivity, isActivityKind, type ActivityItem, type ActivityKind } from "./activity-labels";
import { MEMBER_ROLES } from "./team-roles";
import styles from "./tools.module.css";

type Props = { eventId: string; initial: ActivityItem[]; nextCursor: string | null; timeZone: string; currency: string; now: string };

export default function ActivityList({ eventId, initial, nextCursor, timeZone, currency, now }: Props) {
  const t = useTranslations("dashboard.activity");
  const team = useTranslations("dashboard.team");
  const format = useFormat();
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [kind, setKind] = useState<ActivityKind | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const shown = filterActivity(items, kind);
  const at = new Date(now);

  const more = () =>
    cursor &&
    startTransition(async () => {
      setError(null);
      const r = await loadActivity(eventId, cursor);
      if (!r.ok) return setError(r.error);
      setItems((list) => appendPage(list, r.data.items));
      setCursor(r.data.nextCursor);
    });

  const roleName = (role: string | null) => (role && (MEMBER_ROLES as readonly string[]).includes(role) ? team(`roles.${role}.name`) : role ?? "");
  const line = (item: ActivityItem) => {
    const v = activityValues(item);
    const actor = item.actor ? item.actor.name || t("someone") : t("system");
    const key = activityLabelKey(item.action);
    const b = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
    if (!key) return t.rich("unknown", { actor, action: item.action, b });
    return t.rich(`actions.${key}`, { actor, subject: v.subject ?? t("someone"), role: roleName(v.role), b });
  };
  const detail = (item: ActivityItem) => {
    const v = activityValues(item);
    if (v.amountMinor !== null) return format.money(v.amountMinor, v.currency ?? currency);
    if (v.at) return t("newDate", { date: format.dateTime(v.at, timeZone, "long") });
    return null;
  };

  return (
    <Card as="section">
      <CardHeader title={t("title")} />
      <div className={styles.toolbar}>
        <Field label={t("filter")}>
          <Select value={kind} onChange={(e) => setKind(isActivityKind(e.target.value) ? e.target.value : "all")}>
            <option value="all">{t("kinds.all")}</option>
            {ACTIVITY_KINDS.map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}
          </Select>
        </Field>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<History size={20} strokeWidth={1.75} aria-hidden />} title={t(items.length === 0 ? "empty" : "noneOfKind")}>
          {items.length > 0 && cursor ? t("noneOfKindHint") : null}
        </EmptyState>
      ) : (
        <ul className={styles.rows} aria-live="polite">
          {shown.map((item) => {
            const extra = detail(item);
            return (
              <li key={item.id} className={styles.row}>
                <span className={styles.rowMain}>
                  <span>{line(item)}</span>
                  {extra && <span className={styles.muted}>{extra}</span>}
                </span>
                <time className={styles.time} dateTime={item.at} title={format.dateTime(item.at, timeZone, "long")}>{format.relative(item.at, at)}</time>
              </li>
            );
          })}
        </ul>
      )}
      {error && <Banner tone="danger" title={error} />}
      {cursor && (
        <div className={styles.actions}>
          <Button variant="secondary" onClick={more} loading={pending}>{t("loadMore")}</Button>
        </div>
      )}
    </Card>
  );
}
