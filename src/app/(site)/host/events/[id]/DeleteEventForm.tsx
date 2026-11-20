"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Banner, Button, Field, Input } from "@/design";
import styles from "./workspace.module.css";
import { deleteEvent } from "./actions";

// The delete button stays off until the host types the event's name.
// The server checks the name again, so this is a guard against slips, not the lock.
export default function DeleteEventForm({ id, title, guests }: { id: string; title: string; guests: number }) {
  const t = useTranslations("dashboard.delete");
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === title.trim().toLowerCase();

  return (
    <form action={deleteEvent} className={styles.form}>
      <input type="hidden" name="event_id" value={id} />
      <p className={styles.muted}>{t("warning")}</p>
      {guests > 0 ? (
        <Banner tone="warning" title={t("guests", { count: guests })} />
      ) : (
        <p className={styles.muted}>{t("nobody")}</p>
      )}
      <Field label={t.rich("typeToConfirm", { title, b: (c) => <b>{c}</b> })}>
        <Input
          name="confirm_title"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder={title}
        />
      </Field>
      <DeleteButton enabled={matches} />
    </form>
  );
}

function DeleteButton({ enabled }: { enabled: boolean }) {
  const t = useTranslations("dashboard.delete");
  const { pending } = useFormStatus();
  return (
    <Button variant="danger" type="submit" disabled={!enabled || pending} aria-disabled={!enabled || pending}>
      {t(pending ? "deleting" : "button")}
    </Button>
  );
}
