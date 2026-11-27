"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Card, CardHeader, Field, Input } from "@/design";
import { ToastProvider, useToast } from "@/design/client";
import { setEventAccessCode } from "./registration-links-actions";
import styles from "./tools.module.css";

type Props = { eventId: string; accessRequired: boolean };

export default function AccessCodeCard(props: Props) {
  const t = useTranslations("dashboard");
  return (
    <ToastProvider closeLabel={t("tools.close")}>
      <AccessCode {...props} />
    </ToastProvider>
  );
}

function AccessCode({ eventId, accessRequired }: Props) {
  const t = useTranslations("dashboard.accessCode");
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [required, setRequired] = useState(accessRequired);
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await setEventAccessCode(eventId, code);
      if (r.ok) {
        const removed = code.trim() === "";
        setRequired(!removed);
        setCode("");
        toast({ title: t(removed ? "removedToast" : "savedToast"), tone: "success" });
      } else {
        setError(r.error);
      }
    });
  };

  return (
    <Card as="section">
      <CardHeader
        title={t("title")}
        action={<Badge tone={required ? "success" : "neutral"} plain>{t(required ? "on" : "off")}</Badge>}
      />
      <p className={styles.muted}>{t("intro")}</p>
      <form className={styles.form} onSubmit={submit} noValidate>
        <Field label={t("code")} hint={required ? t("hintSet") : t("hint")} error={error ?? undefined}>
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\s/g, ""));
              setError(null);
            }}
            maxLength={32}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            dir="ltr"
            className={styles.code}
            placeholder={required ? t("placeholderSet") : t("placeholder")}
          />
        </Field>
        <Button variant="primary" type="submit" loading={pending}>{t("save")}</Button>
      </form>
    </Card>
  );
}
