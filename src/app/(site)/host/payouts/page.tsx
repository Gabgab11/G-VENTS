import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getFormat } from "@/i18n/format-server";
import { intlLocale } from "@/lib/format";
import { getAvailability, getMyHostApplication } from "@/lib/payments";
import { applicationStatusKey, isPayoutCountry, providerName, sellReasonKey } from "@/lib/payment-text";
import type { components } from "@/lib/api/schema";
import { HostApplicationForm, PayoutChangeForm } from "./HostApplicationForm";
import { Badge, Banner, Card, CardHeader, PageHeader, type BadgeTone } from "@/design";
import Settlements from "./Settlements";
import SubaccountBankForm from "./SubaccountBankForm";
import styles from "./payouts.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.payouts");
  return { title: t("metaTitle"), robots: { index: false } };
}

/** Badge tone for the application's status (approved and able to sell is "ok"). */
function statusTone(status: string): BadgeTone {
  if (status === "ok" || status === "approved") return "success";
  if (status === "submitted") return "warning";
  if (status === "declined" || status === "revoked") return "danger";
  return "neutral";
}

const OK: Record<string, string> = {
  submitted: "ok.submitted",
  payout_changed: "ok.payoutChanged",
  bank_chosen: "ok.bankChosen",
};

type Subaccount = components["schemas"]["PayoutSubaccountDto"];

/** Message id and badge tone for a provider's subaccount (PS10–PS13). */
const SUBACCOUNT: Record<Subaccount["status"], { key: string; tone: BadgeTone }> = {
  active: { key: "providers.active", tone: "success" },
  pending: { key: "providers.pending", tone: "warning" },
  needs_host: { key: "providers.needsHost", tone: "warning" },
  failed: { key: "providers.failed", tone: "danger" },
};

// Selling paid tickets (M5, FR-20): apply once with payout details and a document; staff approve;
// then the host's Paystack payout account is created. Changing payout details needs two-step sign-in.
export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireUser("/host/payouts");
  const [app, availability] = await Promise.all([getMyHostApplication(), getAvailability()]);
  const [t, root, format, shell] = await Promise.all([getTranslations("account.payouts"), getTranslations(), getFormat(), getTranslations("host.shell")]);
  const dateLocale = intlLocale(format.lang, "date");
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }) : "";
  const ok = sp.ok && Object.hasOwn(OK, sp.ok) ? t(OK[sp.ok]!) : null;
  const countries = (availability?.countries ?? []).filter(isPayoutCountry);
  const canApply = !!app && (app.status === "none" || app.status === "declined");
  const reason = app && !app.canSellPaid ? sellReasonKey(app.reason) : null;
  const statusKey = app ? applicationStatusKey(app.status) : null;
  const payout = app?.payoutAccount ?? null;
  const subaccounts = payout?.subaccounts ?? [];
  // PS6: paid sales are paused (no provider for the country, or no active subaccount with it).
  const paused = app?.status === "approved" && app.paidSales?.paused ? app.paidSales : null;
  const waitingOn = paused?.reason === "no_subaccount" ? subaccounts.find((sa) => sa.provider === paused.provider) : undefined;

  return (
    <>
      <PageHeader title={shell("payouts")} subtitle={t("intro")} />

      {ok && <Banner tone="success" title={ok} />}
      {!app && <p className="error" role="alert">{t("loadFailed")}</p>}
      {paused && (
        <Banner tone="warning" title={t("paused.title")}>
          {paused.reason === "no_provider"
            ? t("paused.noProvider", { country: app?.payoutCountry ? format.country(app.payoutCountry) : "" })
            : waitingOn?.status === "needs_host"
              ? t("paused.needsHost", { provider: providerName(paused.provider) })
              : t("paused.noSubaccount", { provider: providerName(paused.provider) })}
        </Banner>
      )}

      {app && app.status !== "none" && (
        <Card as="section" aria-labelledby="pay-status">
          <CardHeader id="pay-status" title={t("status.title")} action={<Badge tone={statusTone(app.canSellPaid ? "ok" : app.status)}>{app.canSellPaid ? t("status.canSell") : statusKey ? root(statusKey) : app.status}</Badge>} />
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
        </Card>
      )}

      {app && payout && (
        <Card as="section" aria-labelledby="pay-account">
          <CardHeader id="pay-account" title={t("account.title")} action={<Badge tone={payout.status === "active" ? "success" : "warning"}>{payout.status === "active" ? t("account.active") : payout.status === "pending" ? t("account.pending") : t("account.replaced")}</Badge>} />
          <p>{t("account.line", { bank: payout.bankName ?? payout.bankCode, last4: payout.accountNumberLast4 })}{payout.accountName ? ` · ${payout.accountName}` : ""}</p>
          {payout.status === "pending" && <p className="muted small">{t("account.pendingNote")}</p>}
          {subaccounts.length > 0 && (
            <div>
              <h3 className={styles.providersTitle}>{t("providers.title")}</h3>
              <ul className={styles.providers}>
                {subaccounts.map((sa) => (
                  <li key={sa.provider} className={styles.provider}>
                    <span>
                      <Badge tone={SUBACCOUNT[sa.status].tone}>{t(SUBACCOUNT[sa.status].key, { provider: providerName(sa.provider) })}</Badge>
                      {app.paidSales?.provider === sa.provider && <span className={styles.muted}>{" · "}{t("providers.used")}</span>}
                    </span>
                    {sa.status === "failed" && <p className={styles.muted}>{t("providers.failedNote")}</p>}
                    {sa.status === "needs_host" && payout.status !== "replaced" && <SubaccountBankForm provider={sa.provider} country={payout.country} />}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {app.status === "approved" && (
            <details className="pay-details">
              <summary>{t("account.change")}</summary>
              <PayoutChangeForm country={payout.country} />
            </details>
          )}
        </Card>
      )}

      <Settlements />

      {app && canApply && (
        <Card as="section" aria-labelledby="pay-apply">
          <CardHeader id="pay-apply" title={app.status === "declined" ? t("apply.again") : t("apply.title")} />
          {countries.length === 0 ? (
            <p className="muted">{t("apply.closed")}</p>
          ) : (
            <HostApplicationForm countries={countries} defaults={{ legalName: app.legalName ?? "", phone: app.phone ?? "" }} />
          )}
        </Card>
      )}

      <p className="muted small">
        {t.rich("signedIn", {
          email: user.email ?? "",
          fees: (c) => <Link href="/pricing" className="gold">{c}</Link>,
          refunds: (c) => <Link href="/refunds" className="gold">{c}</Link>,
        })}
      </p>
    </>
  );
}
