import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/admin";
import { Badge, Card, CardHeader } from "@/design";
import { PAYOUT_COUNTRIES, PROVIDER_IDS, PROVIDER_NAMES, isPayoutCountry, type ProviderId } from "@/lib/payment-text";
import { setProviderCountry, setProviderEnabled } from "./payment-actions";
import { ActiveProviderForm, ChargeScheduleForm, SwitchForm } from "./PaymentControls";
import s from "./payments.module.css";

type Settings = components["schemas"]["AdminSettingsDto"];
type ProviderStatus = components["schemas"]["ProviderStatusDto"];
type ProviderCountry = components["schemas"]["ProviderCountryDto"];

/** PS9: what a country still needs before it can be switched on, in words. */
function missingText(m: ProviderCountry["missing"][number], row: ProviderCountry): string {
  const provider = PROVIDER_NAMES[row.provider];
  if (m === "keys") return row.provider === "paystack" ? `Set Paystack's keys for ${row.country} on the server` : "Set Flutterwave's keys and webhook hash on the server";
  if (m === "fee") return `Set a G-ventZ fee for ${row.currency}`;
  if (m === "vat") return `Set a VAT rate for ${row.currency} (0% is allowed)`;
  return `Confirm ${provider}'s charge for ${row.country}`;
}

/** PS2: why a provider can't be made active now. */
function notCandidate(provider: ProviderId, s: Settings): string {
  const state = s.payments[provider];
  if (!state.enabled) return `Switch ${PROVIDER_NAMES[provider]} on first.`;
  if (!state.configured) return `Set ${PROVIDER_NAMES[provider]}'s keys and webhook secret on the server first.`;
  return "Switch on at least one country with a confirmed charge first.";
}

const yesNo = (v: boolean) => (v ? <Badge tone="success">Yes</Badge> : <Badge tone="danger">No</Badge>);

function StatusList({ status }: { status: ProviderStatus | undefined }) {
  if (!status) return <p className={s.hint}>Status isn&apos;t available right now.</p>;
  const perCountry = status.provider === "paystack" ? Object.entries(status.keysByCountry) : [];
  return (
    <dl className={s.facts}>
      <dt>Keys</dt>
      <dd>
        {perCountry.length > 0 ? (
          <span className={s.chips}>{perCountry.map(([c, ok]) => <Badge key={c} tone={ok ? "success" : "danger"}>{`${c} ${ok ? "set" : "missing"}`}</Badge>)}</span>
        ) : yesNo(status.keysPresent)}
      </dd>
      <dt>Webhook secret</dt><dd>{yesNo(status.webhookSecretPresent)}</dd>
      <dt>Last valid webhook</dt><dd>{status.lastWebhookAt ? formatDate(status.lastWebhookAt, true) : "None yet"}</dd>
      <dt>Last successful charge</dt><dd>{status.lastSuccessfulChargeAt ? formatDate(status.lastSuccessfulChargeAt, true) : "None yet"}</dd>
    </dl>
  );
}

function ProviderCard({ provider, settings, status }: { provider: ProviderId; settings: Settings; status: ProviderStatus | undefined }) {
  const name = PROVIDER_NAMES[provider];
  const state = settings.payments[provider];
  const active = settings.activeProvider === provider;
  const rows = settings.providerCountries.filter((r) => r.provider === provider);
  const lockedOn = active && state.enabled;
  const switchHint = lockedOn
    ? "This is the active provider. Make another provider active before switching it off."
    : !state.enabled && !state.configured ? `Set ${name}'s keys on the server before switching it on.` : undefined;

  return (
    <Card as="section" className={s.card} aria-labelledby={`pay-${provider}`}>
      <CardHeader
        id={`pay-${provider}`}
        title={<span className={s.cardTitle}>{name}{active && <Badge tone="success">Active</Badge>}{state.enabled ? <Badge tone="info" plain>On</Badge> : <Badge plain>Off</Badge>}</span>}
        action={<SwitchForm action={setProviderEnabled} fields={{ provider }} checked={state.enabled} disabled={lockedOn || (!state.enabled && !state.configured)} label={`${name} switched on`} describedBy={switchHint ? `pay-${provider}-hint` : undefined} />}
      />
      {switchHint && <p id={`pay-${provider}-hint`} className={s.hint}>{switchHint}</p>}
      <StatusList status={status} />

      <h3 className={s.h3}>Countries</h3>
      <ul className={s.countries}>
        {rows.map((row) => {
          const country = isPayoutCountry(row.country) ? PAYOUT_COUNTRIES[row.country].name : row.country;
          const blocked = !row.enabled && row.missing.length > 0;
          return (
            <li key={row.country} className={s.country}>
              <div className={s.countryHead}>
                <span className={s.countryName}>
                  <b>{country}</b> <span className={s.hint}>{row.currency}{row.exponent === 0 ? " · no decimals" : ""}</span>
                  {row.enabled ? <Badge tone="success" plain>On</Badge> : <Badge plain>Off</Badge>}
                  {!row.charges?.confirmed && <Badge tone="warning">Charge unconfirmed</Badge>}
                </span>
                <SwitchForm action={setProviderCountry} fields={{ provider, country: row.country }} checked={row.enabled} disabled={blocked}
                  label={`${name} in ${country}`} describedBy={blocked ? `pay-${provider}-${row.country}-why` : undefined} />
              </div>
              {blocked && (
                <div id={`pay-${provider}-${row.country}-why`} className={s.hint}>
                  Can&apos;t switch on yet:
                  <ul className={s.missing}>{row.missing.map((m) => <li key={m}>{missingText(m, row)}</li>)}</ul>
                </div>
              )}
              <details className={s.details}>
                <summary>Charge schedule</summary>
                <ChargeScheduleForm provider={provider} country={row.country} countryName={country} currency={row.currency} exponent={row.exponent} charges={row.charges} />
              </details>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// Admin → Settings → Payments (Change 5 chunk 4): the active provider, then a card per provider with
// its switch, status, countries (PS9 reasons) and charge schedules (PS15).
export default function PaymentsSection({ settings, status }: { settings: Settings; status: ProviderStatus[] | null }) {
  const why = Object.fromEntries(PROVIDER_IDS.filter((p) => !settings.activeCandidates.includes(p)).map((p) => [p, notCandidate(p, settings)]));
  return (
    <section id="payments" className={s.section} aria-labelledby="ad-pay-title">
      <div className="ad-panel-head">
        <h2 id="ad-pay-title" className="ad-h2">Payments</h2>
        <span className="muted small">New checkouts use the active provider where it is on, otherwise the other one. Every change is audited.</span>
      </div>
      <Card>
        <ActiveProviderForm key={settings.activeProvider ?? "none"} active={settings.activeProvider} candidates={settings.activeCandidates} why={why} />
      </Card>
      <div className={s.cards}>
        {PROVIDER_IDS.map((p) => <ProviderCard key={p} provider={p} settings={settings} status={status?.find((x) => x.provider === p)} />)}
      </div>
    </section>
  );
}
