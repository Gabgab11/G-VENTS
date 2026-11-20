import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ScanLine } from "lucide-react";
import { api, data } from "@/lib/api/server";
import { formatDateTime } from "@/lib/format";
import type { Locale } from "@/i18n/languages";
import { Button, Card, EmptyState, PageHeader } from "@/design";
import { scannable, scanNow } from "./pick";
import styles from "./scan.module.css";

// The phone tab bar's Scan (D87): straight to the scanner when one event is on now, otherwise a choice.
export default async function ScanPickerPage() {
  const list = await (await api()).GET("/v1/me/events", { params: { query: { page: 1, pageSize: 100 } } }).then(data);
  const now = new Date();
  const one = scanNow(list.items, now);
  if (one) redirect(`/host/events/${one.id}/scan`);
  const [t, lang] = await Promise.all([getTranslations("host.scan"), getLocale() as Promise<Locale>]);
  const events = scannable(list.items, now);
  return (
    <>
      <PageHeader title={t("title")} subtitle={events.length ? t("lead") : undefined} />
      {events.length === 0 ? (
        <EmptyState icon={<ScanLine size={20} strokeWidth={1.75} aria-hidden />} title={t("none")} action={<Button href="/host/events" size="sm">{t("events")}</Button>}>{t("noneHint")}</EmptyState>
      ) : (
        <ul className={styles.list}>
          {events.map((e) => (
            <li key={e.id}>
              <Card className={styles.row}>
                <span className={styles.text}>
                  <strong>{e.title}</strong>
                  <span className={styles.muted}>{formatDateTime(e.startsAt, e.timeZone, lang, "long")}</span>
                </span>
                <Button href={`/host/events/${e.id}/scan`} variant="accent" size="sm">{t("open")}</Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
