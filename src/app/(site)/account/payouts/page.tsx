import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import SiteHeader from "@/components/SiteHeader";
import { requireUser } from "@/lib/auth";
import { getFormat } from "@/i18n/format-server";
import { intlLocale } from "@/lib/format";
import { getAvailability, getMyHostApplication } from "@/lib/payments";
import { applicationStatusKey, isPayoutCountry, sellReasonKey } from "@/lib/payment-text";
import { HostApplicationForm, PayoutChangeForm } from "./HostApplicationForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.payouts");
  return { title: t("metaTitle"), robots: { index: false } };
}

const OK: Record<string, string> = {
  submitted: "ok.submitted",
  payout_changed: "ok.payoutChanged",
};

// Selling paid tickets (M5, FR-20): apply once with payout details and a document; staff approve;
// then the host's Paystack payout account is created. Changing payout details needs two-step sign-in.
export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireUser("/account/payouts");
  const [app, availability] = await Promise.all([getMyHostApplication(), getAvailability()]);
  const [t, root, format] = await Promise.all([getTranslations("account.payouts"), getTranslations(), getFormat()]);
  const dateLocale = intlLocale(format.lang, "date");
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }) : "";
  const ok = sp.ok && Object.hasOwn(OK, sp.ok) ? t(OK[sp.ok]!) : null;
  const countries = (availability?.countries ?? []).filter(isPayoutCountry);
  const canApply = !!app && (app.status === "none" || app.status === "declined");
  const reason = app && !app.canSellPaid ? sellReasonKey(app.reason) : null;
  const statusKey = app ? applicationStatusKey(app.status) : null;
  const payout = app?.payoutAccount ?? null;

  return (
    <main className="wrap page">
      <SiteHeader back="/dashboard" />
      <h1>{t("title")}</h1>
      <p className="muted">{t("intro")}</p>

      {ok && <p className="ok-note" role="status">{ok}</p>}
      {!app && <p className="error" role="alert">{t("loadFailed")}</p>}

      {app && app.status !== "none" && (
        <section className="panel stack" aria-labelledby="pay-status">
          <div className="spread">
            <div id="pay-status" className="panel-label">{t("status.title")}</div>
            <span className={`pay-pill ${app.canSellPaid ? "ok" : app.status}`}>{app.canSellPaid ? t("status.canSell") : statusKey ? root(statusKey) : app.status}</span>
          </div>
          {reason && <p className="muted">{root(reason.key)}</p>}
          {app.decisionReason && (app.status === "declined" || app.status === "revoked") && (
            <p>{t.rich("status.decisionReason", { reason: app.decisionReason, b: (c) => <b>{c}</b> })}</p>
          )}
          <dl className="pay-facts">
            {app.legalName && <><dt>{t("status.name")}</dt><dd>{app.legalName}</dd></>}
            {app.payoutCountry && <><dt>{t("status.country")}</dt><dd>{t("status.countryValue", { country: format.country(app.payoutCountry), currency: app.currency ?? "" })}</dd></>}
            {app.submittedAt && <><dt>{t("status.applied")}</dt><dd>{fmtDate(app.submittedAt)}</dd></>}
            {app.decidedAt && <><dt>{t("status.decided")}</dt><dd>{fmtDate(app.decidedAt)}</dd></>}
          </dl>
          {app.debts.length > 0 && (
            <div className="pay-owed" role="note">
              <b>{t("status.owed", { amounts: app.debts.map((d) => format.money(d.owedMinor, d.currency)).reduce((first, second) => t("status.owedJoin", { first, second })) })}</b>
              <p className="muted small">{t("status.owedNote")}</p>
            </div>
          )}
        </section>
      )}

      {app && payout && (
        <section className="panel stack" aria-labelledby="pay-account">
          <div className="spread">
            <div id="pay-account" className="panel-label">{t("account.title")}</div>
            <span className={`pay-pill ${payout.status === "active" ? "ok" : "submitted"}`}>{payout.status === "active" ? t("account.active") : payout.status === "pending" ? t("account.pending") : t("account.replaced")}</span>
          </div>
          <p>{t("account.line", { bank: payout.bankName ?? payout.bankCode, last4: payout.accountNumberLast4 })}{payout.accountName ? ` · ${payout.accountName}` : ""}</p>
          {payout.status === "pending" && <p className="muted small">{t("account.pendingNote")}</p>}
          {app.status === "approved" && (
            <details className="pay-details">
              <summary>{t("account.change")}</summary>
              <PayoutChangeForm country={payout.country} />
            </details>
          )}
        </section>
      )}

      {app && canApply && (
        <section className="panel stack" aria-labelledby="pay-apply">
          <div id="pay-apply" className="panel-label">{app.status === "declined" ? t("apply.again") : t("apply.title")}</div>
          {countries.length === 0 ? (
            <p className="muted">{t("apply.closed")}</p>
          ) : (
            <HostApplicationForm countries={countries} defaults={{ legalName: app.legalName ?? "", phone: app.phone ?? "" }} />
          )}
        </section>
      )}

      <p className="muted small">
        {t.rich("signedIn", {
          email: user.email ?? "",
          fees: (c) => <Link href="/pricing" className="gold">{c}</Link>,
          refunds: (c) => <Link href="/refunds" className="gold">{c}</Link>,
        })}
      </p>
    </main>
  );
}
