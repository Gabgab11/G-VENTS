"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  CURRENCY_CODES, CURRENCY_INFO, PRICES, EXAMPLE_TICKET, EXAMPLE_QUANTITY, money, type CurrencyCode,
} from "@/lib/currency";
import SiteHeader from "@/components/SiteHeader";

// Plan names are product names and stay as they are; descriptions, features and buttons are in
// messages/*/info.json (info.pricing.*).
const PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    fee: 3,
    feats: ["unlimitedEvents", "freeTickets", "qrCheckIn", "standardPages"],
    href: "/sign-up?next=/events/new",
    cta: "signUpFree",
    featured: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    fee: 1.5,
    feats: ["everythingStarter", "customizablePages", "prioritySupport", "optionalDomain"],
    href: null,
    cta: "comingSoon",
    featured: true,
  },
  {
    id: "business" as const,
    name: "Business",
    fee: 0.5,
    feats: ["everythingPro", "brandedPages", "customDomain", "apiAccess"],
    href: null,
    cta: "comingSoon",
    featured: false,
  },
];

// Feature (an id under info.pricing.compare.features), then Starter, Pro, Business: an id under
// info.pricing.compare.values, or a number shown as it is. Promo codes, email reminders, analytics
// and team members are left out until they ship (D86).
const ROWS: [string, string, string, string][] = [
  ["eventCreation", "unlimited", "unlimited", "unlimited"],
  ["freeTickets", "free", "free", "free"],
  ["platformFee", "3%", "1.5%", "0.5%"],
  ["customPages", "standard", "customizable", "fullyBranded"],
  ["attendeeManagement", "yes", "yes", "yes"],
  ["qrTickets", "yes", "yes", "yes"],
  ["checkIn", "yes", "yes", "yes"],
  ["exportData", "yes", "yes", "yes"],
  ["prioritySupport", "no", "yes", "yes"],
  ["customDomain", "no", "optional", "yes"],
  ["apiAccess", "no", "no", "yes"],
];

function priceOf(id: "starter" | "pro" | "business", code: CurrencyCode): number {
  if (id === "starter") return 0;
  return PRICES[code][id];
}

export default function PricingPlans() {
  const t = useTranslations("info.pricing");
  const [code, setCode] = useState<CurrencyCode>("USD");
  const value = (v: string) => (/^\d/.test(v) ? v : t(`compare.values.${v}`));
  const ticket = EXAMPLE_TICKET[code];
  const sales = ticket * EXAMPLE_QUANTITY;

  return (
    <main className="wrap page wide pricing">
      <SiteHeader />

      <header className="pr-hero">
        <div className="pr-eyebrow">{t("hero.eyebrow")}</div>
        <h1>{t("hero.title")}</h1>
        <p>{t("hero.text")}</p>
      </header>

      <div className="cur-switch" role="group" aria-label={t("currency.choose")}>
        {CURRENCY_CODES.map((c) => (
          <button
            key={c}
            type="button"
            className="cur-btn"
            aria-pressed={code === c}
            onClick={() => setCode(c)}
          >
            {t.has(`currency.${c.toLowerCase()}`) ? t(`currency.${c.toLowerCase()}`) : CURRENCY_INFO[c].label}
          </button>
        ))}
      </div>

      <div className="pr-grid pr-flip" key={code}>
        {PLANS.map((p) => {
          const amount = priceOf(p.id, code);
          return (
            <article key={p.id} className={`pr-card ${p.featured ? "featured" : ""}`}>
              {p.featured && <span className="pr-badge">{t("plan.popular")}</span>}
              <div className="pr-name">{p.name}</div>
              <div className="pr-desc">{t(`plan.${p.id}`)}</div>
              <div className="pr-price">
                {money(amount, code)}
                <span>{t("plan.perMonth")}</span>
              </div>
              <div className="pr-fee">{t("plan.fee", { fee: p.fee })}</div>
              <ul className="pr-list">
                {p.feats.map((f) => <li key={f}>{t(`features.${f}`)}</li>)}
              </ul>
              {p.href ? (
                <Link href={p.href} className="pr-cta primary">{t(`plan.${p.cta}`)}</Link>
              ) : (
                <span className="pr-cta off" aria-disabled="true">{t(`plan.${p.cta}`)}</span>
              )}
            </article>
          );
        })}
      </div>

      <section className="pr-example">
        <h2>{t("example.title")}</h2>
        <p className="muted small">
          {t("example.text", { quantity: String(EXAMPLE_QUANTITY), price: money(ticket, code) })}
        </p>
        <div className="row"><span>{t("example.sales")}</span><b>{money(sales, code)}</b></div>
        <div className="row"><span>{t("example.starter")}</span><b>{money(sales * 0.03, code)}</b></div>
        <div className="row"><span>{t("example.pro")}</span><b>{money(sales * 0.015, code)} + {money(PRICES[code].pro, code)}</b></div>
        <div className="row"><span>{t("example.business")}</span><b>{money(sales * 0.005, code)} + {money(PRICES[code].business, code)}</b></div>
        <p className="muted small">{t("example.note")}</p>
      </section>

      <details className="pr-compare">
        <summary>{t("compare.title")}</summary>
        <div className="table-scroll">
          <table className="plan-table">
            <thead>
              <tr>
                <th>{t("compare.feature")}</th>
                {PLANS.map((p) => <th key={p.id}>{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t("compare.monthlyPrice")}</td>
                <td>{money(0, code)}</td>
                <td>{money(PRICES[code].pro, code)}</td>
                <td>{money(PRICES[code].business, code)}</td>
              </tr>
              {ROWS.map(([feature, a, b, c]) => (
                <tr key={feature}>
                  <td>{t(`compare.features.${feature}`)}</td>
                  <td>{value(a)}</td>
                  <td>{value(b)}</td>
                  <td>{value(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="meta">
        <Link href="/terms">{t("links.terms")}</Link> · <Link href="/refunds">{t("links.refunds")}</Link> · <Link href="/privacy">{t("links.privacy")}</Link>
      </p>
    </main>
  );
}
