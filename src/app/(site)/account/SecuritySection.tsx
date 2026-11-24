import { getTranslations } from "next-intl/server";
import { Banner, Button, Card, CardHeader } from "@/design";
import type { MfaState, Method } from "@/lib/mfa";
import { EnrollForm, VerifyForm } from "../host/settings/security/MfaForms";
import { AddPasskey, UsePasskey } from "../host/settings/security/Passkeys";
import { removeSecurityMethod } from "./actions";
import s from "./account.module.css";

// Sign-in & security (FR-35, D94: passwordless): passkeys and the authenticator app, with the same
// forms as host Settings → Security (which hosts keep). After adding or confirming, back here.
const DONE = "/account?security=done#security";

export default async function SecuritySection({ mfa, status, formatDate }: { mfa: MfaState; status?: string; formatDate: (iso: string) => string }) {
  const t = await getTranslations("account.security");
  const page = await getTranslations("account.page.security");
  const { level, factor, passkeys } = mfa;
  const confirmed = level === "aal2";
  const hasAny = !!factor || passkeys.length > 0;

  const remove = (m: Method, label: string) => (
    <form action={removeSecurityMethod}>
      <input type="hidden" name="factor_id" value={m.id} />
      <Button type="submit" variant="ghost" size="sm" aria-label={t("removeLabel", { label })}>{t("remove")}</Button>
    </form>
  );

  return (
    <Card as="section" id="security" aria-labelledby="account-security" className={s.section}>
      <CardHeader title={<span id="account-security">{page("title")}</span>} />
      <p className={s.hint}>{page("intro")}</p>

      {status === "done" && <Banner tone="success" title={t("done")} />}
      {status === "removed" && <Banner tone="success" title={t("removed")} />}
      {status === "remove-failed" && <Banner tone="danger" title={t("removeFailed")} />}

      {!hasAny && (
        <>
          <div className={s.group}>
            <h3 className={s.subheading}>{t("passkeyTitle")}</h3>
            <p className={s.hint}>{t("passkeyHint")}</p>
            <AddPasskey next={DONE} />
          </div>
          <div className={s.group}>
            <h3 className={s.subheading}>{t("appTitle")}</h3>
            <EnrollForm next={DONE} />
          </div>
        </>
      )}

      {hasAny && !confirmed && (
        <div className={s.group}>
          <h3 className={s.subheading}>{t("confirmTitle")}</h3>
          <p className={s.hint}>{page("confirmHint")}</p>
          {passkeys.map((p) => <UsePasskey key={p.id} factorId={p.id} name={p.name} next={DONE} />)}
          {factor && (
            <>
              {passkeys.length > 0 && <p className={s.hint}>{t("orCode")}</p>}
              <VerifyForm next={DONE} />
            </>
          )}
        </div>
      )}

      {hasAny && confirmed && (
        <>
          <div className={s.group}>
            <h3 className={s.subheading}>{t("methodsTitle")}</h3>
            <ul className={s.methods}>
              {passkeys.map((p) => (
                <li key={p.id}>
                  <span><b>{p.name || t("passkeyName")}</b> <span className={s.hint}>{t("passkeyAdded", { date: formatDate(p.createdAt) })}</span></span>
                  {remove(p, p.name || t("removeLabelPasskey"))}
                </li>
              ))}
              {factor && (
                <li>
                  <span><b>{t("appName")}</b> <span className={s.hint}>{t("appAdded", { date: formatDate(factor.createdAt) })}</span></span>
                  {remove(factor, t("removeLabelApp"))}
                </li>
              )}
            </ul>
            <p className={s.hint}>{t("methodsNote")}</p>
          </div>
          <div className={s.group}>
            <h3 className={s.subheading}>{t("addPasskeyTitle")}</h3>
            <AddPasskey next={DONE} />
          </div>
          {!factor && (
            <div className={s.group}>
              <h3 className={s.subheading}>{t("addAppTitle")}</h3>
              <EnrollForm next={DONE} />
            </div>
          )}
        </>
      )}
    </Card>
  );
}
