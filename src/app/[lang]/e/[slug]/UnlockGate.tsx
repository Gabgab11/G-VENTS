"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Button, Card, CardHeader, Field, Input } from "@/design";
import { unlockRegistration } from "./tickets/unlock-action";
import styles from "./UnlockGate.module.css";

// Change 6 (FR-40): the access-code gate on the booking page. The guest types the code; on success the
// unlock action sets an httpOnly cookie and we refresh, so the server renders the order form instead.
export default function UnlockGate({ eventId, linkToken, linkName }: { eventId: string; linkToken: string; linkName: string | null }) {
  const t = useTranslations("event.access");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await unlockRegistration(eventId, linkToken, code);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  };

  return (
    <Card as="section" className={styles.gate}>
      <CardHeader title={t("title")} />
      <p className={styles.lead}>
        <Lock size={16} strokeWidth={1.75} aria-hidden />
        <span>{linkName ? t("leadNamed", { name: linkName }) : t("lead")}</span>
      </p>
      <form className={styles.form} onSubmit={submit} noValidate>
        <Field label={t("code")} error={error ?? undefined}>
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\s/g, ""));
              setError(null);
            }}
            maxLength={64}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            dir="ltr"
            autoFocus
          />
        </Field>
        <Button variant="primary" type="submit" loading={pending}>{t("submit")}</Button>
      </form>
    </Card>
  );
}
