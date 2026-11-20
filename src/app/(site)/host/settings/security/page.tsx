import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { intlLocale } from "@/lib/format";
import { getFormat } from "@/i18n/format-server";
import { mfaState, safeNext, type Method } from "@/lib/mfa";
import { removeFactor } from "./actions";
import { EnrollForm, VerifyForm } from "./MfaForms";
import { AddPasskey, UsePasskey } from "./Passkeys";
import { Banner, Card, CardHeader } from "@/design";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.security");
  return { title: t("metaTitle"), robots: { index: false } };
}

const addedOn = (m: Method, lang: string) => new Date(m.createdAt).toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" });

async function RemoveButton({ id, label }: { id: string; label: string }) {
  const t = await getTranslations("account.security");
  return (
    <form action={removeFactor}>
      <input type="hidden" name="factor_id" value={id} />
      <button type="submit" className="link-btn" aria-label={t("removeLabel", { label })}>{t("remove")}</button>
    </form>
  );
}

// Two-step sign-in (D54): a passkey (Touch ID, Face ID, Windows Hello, a phone or a security key)
// or an authenticator app. With `?next=` it is also the "confirm it's you" step that staff pages
// send people to when the API answers auth.mfa_required.
export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ next?: string; done?: string; removed?: string; err?: string }> }) {
  const sp = await searchParams;
  await requireUser(`/host/settings/security${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`);
  const next = safeNext(sp.next, "/host/settings/security?done=1");
  const { level, factor, passkeys } = await mfaState();
  const confirmed = level === "aal2";
  const hasAny = !!factor || passkeys.length > 0;
  if (confirmed && sp.next) redirect(next);
  const after = sp.next ? next : "/host/settings/security?done=1";
  const t = await getTranslations("account.security");
  const dateLocale = intlLocale((await getFormat()).lang, "date");
  const added = (m: Method) => addedOn(m, dateLocale);

  return (
    <>
      <p className="muted">
        {t.rich("intro", { b: (c) => <b>{c}</b> })}
      </p>

      {sp.done && <Banner tone="success" title={t("done")} />}
      {sp.removed && <Banner tone="success" title={t("removed")} />}
      {sp.err && <p className="error" role="alert">{t("removeFailed")}</p>}

      {/* Not set up yet: offer both, passkey first. */}
      {!hasAny && (
        <>
          <Card as="section" aria-labelledby="sec-passkey">
            <CardHeader id="sec-passkey" title={t("passkeyTitle")} headingLevel={2} />
            <p className="muted small">{t("passkeyHint")}</p>
            <AddPasskey next={after} />
          </Card>
          <Card as="section" aria-labelledby="sec-totp">
            <CardHeader id="sec-totp" title={t("appTitle")} headingLevel={2} />
            <EnrollForm next={after} />
          </Card>
        </>
      )}

      {/* Set up, but this session isn't confirmed yet. */}
      {hasAny && !confirmed && (
        <Card as="section" aria-labelledby="sec-confirm">
          <CardHeader id="sec-confirm" title={t("confirmTitle")} headingLevel={2} />
          <p className="muted small">{sp.next ? t("confirmHintContinue") : t("confirmHint")}</p>
          {passkeys.map((p) => <UsePasskey key={p.id} factorId={p.id} name={p.name} next={after} />)}
          {factor && (
            <>
              {passkeys.length > 0 && <p className="muted small">{t("orCode")}</p>}
              <VerifyForm next={after} />
            </>
          )}
        </Card>
      )}

      {/* Confirmed: manage methods. */}
      {hasAny && confirmed && (
        <>
          <Card as="section" aria-labelledby="sec-methods">
            <CardHeader id="sec-methods" title={t("methodsTitle")} headingLevel={2} />
            <ul className="sec-methods">
              {passkeys.map((p) => (
                <li key={p.id}><span><b>{p.name || t("passkeyName")}</b><span className="muted small">{" "}{t("passkeyAdded", { date: added(p) })}</span></span><RemoveButton id={p.id} label={p.name || t("removeLabelPasskey")} /></li>
              ))}
              {factor && (
                <li><span><b>{t("appName")}</b><span className="muted small">{" "}{t("appAdded", { date: added(factor) })}</span></span><RemoveButton id={factor.id} label={t("removeLabelApp")} /></li>
              )}
            </ul>
            <p className="muted small">{t("methodsNote")}</p>
          </Card>
          <Card as="section" aria-labelledby="sec-add">
            <CardHeader id="sec-add" title={t("addPasskeyTitle")} headingLevel={2} />
            <AddPasskey next="/host/settings/security?done=1" />
          </Card>
          {!factor && (
            <Card as="section" aria-labelledby="sec-add-totp">
              <CardHeader id="sec-add-totp" title={t("addAppTitle")} headingLevel={2} />
              <EnrollForm next="/host/settings/security?done=1" />
            </Card>
          )}
        </>
      )}
    </>
  );
}
