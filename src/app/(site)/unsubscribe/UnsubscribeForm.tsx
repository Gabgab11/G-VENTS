"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/design";
import { confirmUnsubscribe, type UnsubscribeState } from "./actions";

// A button rather than unsubscribing on page load, so mail scanners that open links don't
// unsubscribe people by accident. (Mail apps' own unsubscribe button posts to /api/unsubscribe.)
export default function UnsubscribeForm({ token }: { token: string }) {
  const t = useTranslations("auth.unsubscribe");
  const [state, action, pending] = useActionState<UnsubscribeState, FormData>(confirmUnsubscribe, undefined);

  if (state?.ok) {
    return (
      <>
        <h1 className="auth-title">{t("doneTitle")}</h1>
        <p className="muted">{t("doneBody", { event: state.eventTitle })}</p>
      </>
    );
  }
  return (
    <form action={action} className="auth-form">
      <h1 className="auth-title">{t("title")}</h1>
      <p className="muted">{t("body")}</p>
      <input type="hidden" name="token" value={token} />
      {state && !state.ok && (
        <p className="error" role="alert">
          {state.reason === "unknown" ? t("unknownLink") : t("failed")}
        </p>
      )}
      <Button variant="primary" type="submit" fullWidth disabled={pending}>{pending ? t("pending") : t("button")}</Button>
    </form>
  );
}
