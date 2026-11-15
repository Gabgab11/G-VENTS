import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import SiteHeader from "@/components/SiteHeader";
import { requireUser } from "@/lib/auth";
import { intlLocale } from "@/lib/format";
import { getFormat } from "@/i18n/format-server";
import { mfaState, safeNext, type Method } from "@/lib/mfa";
import { removeFactor } from "./actions";
import { EnrollForm, VerifyForm } from "./MfaForms";
import { AddPasskey, UsePasskey } from "./Passkeys";

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
  await requireUser(`/account/security${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`);
  const next = safeNext(sp.next, "/account/security?done=1");
  const { level, factor, passkeys } = await mfaState();
  const confirmed = level === "aal2";
  const hasAny = !!factor || passkeys.length > 0;
  if (confirmed && sp.next) redirect(next);
  const after = sp.next ? next : "/account/security?done=1";
  const t = await getTranslations("account.security");
  const dateLocale = intlLocale((await getFormat()).lang, "date");
  const added = (m: Method) => addedOn(m, dateLocale);

  return (
    <main className="wrap page">
      <SiteHeader back="/dashboard" />
      <h1>{t("title")}</h1>
      <p className="muted">
        {t.rich("intro", { b: (c) => <b>{c}</b> })}
      </p>

      {sp.done && <p className="ok-note" role="status">{t("done")}</p>}
      {sp.removed && <p className="ok-note" role="status">{t("removed")}</p>}
      {sp.err && <p className="error" role="alert">{t("removeFailed")}</p>}

      {/* Not set up yet: offer both, passkey first. */}
      {!hasAny && (
        <>
          <section className="panel stack" aria-labelledby="sec-passkey">
            <div id="sec-passkey" className="panel-label">{t("passkeyTitle")}</div>
            <p className="muted small">{t("passkeyHint")}</p>
            <AddPasskey next={after} />
          </section>
          <section className="panel stack" aria-labelledby="sec-totp">
            <div id="sec-totp" className="panel-label">{t("appTitle")}</div>
            <EnrollForm next={after} />
          </section>
        </>
      )}

      {/* Set up, but this session isn't confirmed yet. */}
      {hasAny && !confirmed && (
        <section className="panel stack" aria-labelledby="sec-confirm">
          <div id="sec-confirm" className="panel-label">{t("confirmTitle")}</div>
          <p className="muted small">{sp.next ? t("confirmHintContinue") : t("confirmHint")}</p>
          {passkeys.map((p) => <UsePasskey key={p.id} factorId={p.id} name={p.name} next={after} />)}
          {factor && (
            <>
              {passkeys.length > 0 && <p className="muted small">{t("orCode")}</p>}
              <VerifyForm next={after} />
            </>
          )}
        </section>
      )}

      {/* Confirmed: manage methods. */}
      {hasAny && confirmed && (
        <>
          <section className="panel stack" aria-labelledby="sec-methods">
            <div id="sec-methods" className="panel-label">{t("methodsTitle")}</div>
            <ul className="sec-methods">
              {passkeys.map((p) => (
                <li key={p.id}><span><b>{p.name || t("passkeyName")}</b><span className="muted small">{" "}{t("passkeyAdded", { date: added(p) })}</span></span><RemoveButton id={p.id} label={p.name || t("removeLabelPasskey")} /></li>
              ))}
              {factor && (
                <li><span><b>{t("appName")}</b><span className="muted small">{" "}{t("appAdded", { date: added(factor) })}</span></span><RemoveButton id={factor.id} label={t("removeLabelApp")} /></li>
              )}
            </ul>
            <p className="muted small">{t("methodsNote")}</p>
          </section>
          <section className="panel stack" aria-labelledby="sec-add">
            <div id="sec-add" className="panel-label">{t("addPasskeyTitle")}</div>
            <AddPasskey next="/account/security?done=1" />
          </section>
          {!factor && (
            <section className="panel stack" aria-labelledby="sec-add-totp">
              <div id="sec-add-totp" className="panel-label">{t("addAppTitle")}</div>
              <EnrollForm next="/account/security?done=1" />
            </section>
          )}
        </>
      )}
    </main>
  );
}
