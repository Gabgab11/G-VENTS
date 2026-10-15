import Link from "next/link";

export const metadata = { title: "Pricing · G-ventZ" };

const plans = [
  {
    name: "Starter",
    price: "$0",
    desc: "For organizers getting started with free events.",
    fee: "3% platform fee on paid tickets",
    features: [
      "Unlimited event creation",
      "Free ticket sales",
      "Promo codes",
      "QR code tickets and guest check-in",
      "Basic analytics and email reminders",
      "Standard event pages",
      "1 team member",
    ],
    cta: "Start free",
    href: "/events/new",
    featured: false,
  },
  {
    name: "Pro",
    price: "$19",
    desc: "For regular organizers running events every month.",
    fee: "1.5% platform fee on paid tickets",
    features: [
      "Everything in Starter",
      "Advanced analytics",
      "Advanced email reminders",
      "Customizable event pages",
      "5 team members",
      "Priority support",
      "Optional custom domain",
    ],
    cta: "Coming soon",
    href: null,
    featured: true,
  },
  {
    name: "Business",
    price: "$49",
    desc: "For organizations running large or multiple events.",
    fee: "0.5% platform fee on paid tickets",
    features: [
      "Everything in Pro",
      "Fully branded event pages",
      "15 team members",
      "Custom domain",
      "API access",
    ],
    cta: "Coming soon",
    href: null,
    featured: false,
  },
];

const rows: [string, string, string, string][] = [
  ["Monthly price", "$0", "$19", "$49"],
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

export default function PricingPage() {
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

      <div className="pr-grid">
        {plans.map((p) => (
          <article key={p.name} className={`pr-card ${p.featured ? "featured" : ""}`}>
            {p.featured && <span className="pr-badge">Most popular</span>}
            <div className="pr-name">{p.name}</div>
            <div className="pr-desc">{p.desc}</div>
            <div className="pr-price">
              {p.price}
              <span>/ month</span>
            </div>
            <div className="pr-fee">{p.fee}</div>
            <ul className="pr-list">
              {p.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            {p.href ? (
              <Link href={p.href} className={`pr-cta ${p.featured ? "primary" : ""}`}>{p.cta}</Link>
            ) : (
              <span className="pr-cta off" aria-disabled="true">{p.cta}</span>
            )}
          </article>
        ))}
      </div>

      <section className="pr-example">
        <h2>What fees look like</h2>
        <p className="muted small">Example: an organizer sells 500 tickets at $20 each.</p>
        <div className="row"><span>Ticket sales</span><b>$10,000</b></div>
        <div className="row"><span>Starter fee (3%)</span><b>$300</b></div>
        <div className="row"><span>Pro fee (1.5%)</span><b>$150 + $19 / month</b></div>
        <div className="row"><span>Business fee (0.5%)</span><b>$50 + $49 / month</b></div>
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
              {rows.map(([feature, a, b, c]) => (
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
