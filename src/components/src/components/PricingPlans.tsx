"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CURRENCY_CODES, CURRENCY_INFO, PRICES, EXAMPLE_TICKET, EXAMPLE_QUANTITY, money, type CurrencyCode,
} from "@/lib/currency";

const PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    desc: "For organizers getting started with free events.",
    fee: 3,
    feats: [
      "Unlimited event creation",
      "Free ticket sales",
      "Promo codes",
      "QR code tickets and guest check-in",
      "Basic analytics and email reminders",
      "Standard event pages",
      "1 team member",
    ],
    href: "/sign-in?next=/events/new",
    cta: "Sign up free",
    featured: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    desc: "For regular organizers running events every month.",
    fee: 1.5,
    feats: [
      "Everything in Starter",
      "Advanced analytics",
      "Advanced email reminders",
      "Customizable event pages",
      "5 team members",
      "Priority support",
      "Optional custom domain",
    ],
    href: null,
    cta: "Coming soon",
    featured: true,
  },
  {
    id: "business" as const,
    name: "Business",
    desc: "For organizations running large or multiple events.",
    fee: 0.5,
    feats: [
      "Everything in Pro",
      "Fully branded event pages",
      "15 team members",
      "Custom domain",
      "API access",
    ],
    href: null,
    cta: "Coming soon",
    featured: false,
  },
];

const ROWS: [string, string, string, string][] = [
  ["Event creation", "Unlimited", "Unlimited", "Unlimited"],
  ["Free ticket sales", "Free", "Free", "Free"],
  ["Platform fee on paid tickets", "3%", "1.5%", "0.5%"],
  ["Event analytics", "Basic", "Advanced", "Advanced"],
  ["Promo codes", "Yes", "Yes", "Yes"],
  ["Custom event pages", "Standard", "Customizable", "Fully branded"],
  ["Attendee management", "Yes", "Yes", "Yes"],
  ["QR code tickets", "Yes", "Yes", "Yes"],
  ["Guest check-in", "Yes", "Yes", "Yes"],
  ["Email reminders", "Basic", "Advanced", "Advanced"],
  ["Team members", "1", "5", "15"],
  ["Export attendee data", "Yes", "Yes", "Yes"],
  ["Priority support", "No", "Yes", "Yes"],
  ["Custom domain", "No", "Optional", "Yes"],
  ["API access", "No", "No", "Yes"],
];

function priceOf(id: "starter" | "pro" | "business", code: CurrencyCode): number {
  if (id === "starter") return 0;
  return PRICES[code][id];
}

export default function PricingPlans() {
  const [code, setCode] = useState<CurrencyCode>("USD");
  const ticket = EXAMPLE_TICKET[code];
  const sales = ticket * EXAMPLE_QUANTITY;

  return (
    <main className="wrap page wide pricing">
      <div className="back-row">
        <Link href="/" className="back-link">← Home</Link>
      </div>

      <header className="pr-hero">
        <div className="pr-eyebrow">Pricing</div>
        <h1>Simple pricing that grows with your events</h1>
        <p>Create events for free. You only pay a platform fee when you sell paid tickets.</p>
      </header>

      <div className="cur-switch" role="group" aria-label="Choose currency">
        {CURRENCY_CODES.map((c) => (
          <button
            key={c}
            type="button"
            className="cur-btn"
            aria-pressed={code === c}
            onClick={() => setCode(c)}
          >
            {CURRENCY_INFO[c].label}
          </button>
        ))}
      </div>

      <div className="pr-grid pr-flip" key={code}>
        {PLANS.map((p) => {
          const amount = priceOf(p.id, code);
          return (
            <article key={p.id} className={`pr-card ${p.featured ? "featured" : ""}`}>
              {p.featured && <span className="pr-badge">Most popular</span>}
              <div className="pr-name">{p.name}</div>
              <div className="pr-desc">{p.desc}</div>
              <div className="pr-price">
                {money(amount, code)}
                <span>/ month</span>
              </div>
              <div className="pr-fee">Platform fee on paid tickets: {p.fee}%</div>
              <ul className="pr-list">
                {p.feats.map((f) => <li key={f}>{f}</li>)}
              </ul>
              {p.href ? (
                <Link href={p.href} className="pr-cta primary">{p.cta}</Link>
              ) : (
                <span className="pr-cta off" aria-disabled="true">{p.cta}</span>
              )}
            </article>
          );
        })}
      </div>

      <section className="pr-example">
        <h2>What fees look like</h2>
        <p className="muted small">
          Example: an organizer sells {EXAMPLE_QUANTITY} tickets at {money(ticket, code)} each.
        </p>
        <div className="row"><span>Ticket sales</span><b>{money(sales, code)}</b></div>
        <div className="row"><span>Starter fee (3%)</span><b>{money(sales * 0.03, code)}</b></div>
        <div className="row"><span>Pro fee (1.5%) + monthly price</span><b>{money(sales * 0.015, code)} + {money(PRICES[code].pro, code)}</b></div>
        <div className="row"><span>Business fee (0.5%) + monthly price</span><b>{money(sales * 0.005, code)} + {money(PRICES[code].business, code)}</b></div>
        <p className="muted small">Payment provider charges are separate and apply on every plan.</p>
      </section>

      <details className="pr-compare">
        <summary>Compare all features</summary>
        <div className="table-scroll">
          <table className="plan-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Starter</th>
                <th>Pro</th>
                <th>Business</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Monthly price</td>
                <td>{money(0, code)}</td>
                <td>{money(PRICES[code].pro, code)}</td>
                <td>{money(PRICES[code].business, code)}</td>
              </tr>
              {ROWS.map(([feature, a, b, c]) => (
                <tr key={feature}>
                  <td>{feature}</td>
                  <td>{a}</td>
                  <td>{b}</td>
                  <td>{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="meta">
        <Link href="/terms">Terms</Link> · <Link href="/refunds">Refunds</Link> · <Link href="/privacy">Privacy</Link>
      </p>
    </main>
  );
}
