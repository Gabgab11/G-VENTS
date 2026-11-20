"use client";

import { useId, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Banner, Button } from "@/design";
import { Switch } from "@/design/client";
import { updateEventSetting } from "./actions";
import styles from "./workspace.module.css";

type Props = {
  eventId: string;
  status: "draft" | "published" | "cancelled";
  visibility: "public" | "private";
  showAttendeeCount: boolean;
  canPublish: boolean;
  canEdit: boolean;
};

// Publish, visibility and the attendee count: the quick toggles that used to sit on the event
// list. Each change is saved at once through the API, which checks the caller's role.
export default function QuickSettings({ eventId, status: initialStatus, visibility, showAttendeeCount, canPublish, canEdit }: Props) {
  const t = useTranslations("dashboard.quick");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [isPrivate, setPrivate] = useState(visibility === "private");
  const [show, setShow] = useState(showAttendeeCount);
  const privateId = useId();
  const countId = useId();

  function change(name: string, value: string, apply: () => void) {
    setError(null);
    start(async () => {
      const res = await updateEventSetting(eventId, name, value);
      if (res.error) setError(res.error);
      else apply();
    });
  }

  return (
    <div className={styles.form}>
      {status === "draft" && canPublish && (
        <div className={styles.option}>
          <span className={styles.optionText}>
            <strong>{t("draftTitle")}</strong>
            <span className={styles.muted}>{t("draftHint")}</span>
          </span>
          <Button variant="primary" size="sm" loading={pending} onClick={() => change("status", "published", () => setStatus("published"))}>{t("publish")}</Button>
        </div>
      )}
      {canEdit && (
        <>
          <div className={styles.option}>
            <span className={styles.optionText}>
              <strong id={privateId}>{t("private")}</strong>
              <span className={styles.muted}>{t("privateHint")}</span>
            </span>
            <Switch checked={isPrivate} disabled={pending} aria-labelledby={privateId}
              onCheckedChange={(on) => change("visibility", on ? "private" : "public", () => setPrivate(on))} />
          </div>
          <div className={styles.option}>
            <span className={styles.optionText}>
              <strong id={countId}>{t("showCount")}</strong>
              <span className={styles.muted}>{t("showCountHint")}</span>
            </span>
            <Switch checked={show} disabled={pending} aria-labelledby={countId}
              onCheckedChange={(on) => change("show_attendee_count", String(on), () => setShow(on))} />
          </div>
        </>
      )}
      {error && <Banner tone="danger" title={error} />}
    </div>
  );
}
