import Link from "next/link";
import BackLink from "@/components/BackLink";

export const metadata = { title: "Pricing · G-ventZ" };

const plans = [
  { name: "Starter", price: "$0", fee: "3%", note: "For getting started" },
  { name: "Pro", price: "$19", fee: "1.5%", note: "For regular organizers" },
  { name: "Business", price: "$49", fee: "0.5%", note: "For large organizations" },
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
    <main className="wrap page wide legal">
      <div className="back-row"><BackLink fallback="/" label="← Back" /></div>
      <h1>Pricing</h1>
      <p>Free to create events. You pay a platform fee only on paid tickets, and you can choose the plan that fits your volume.</p>

      <div className="plan-cards">
        {plans.map((p) => (
          <div key={p.name} className="plan-card">
            <b className="plan-name">{p.name}</b>
            <div className="plan-price">{p.price}<span className="muted small"> / month</span></div>
            <div className="small">Platform fee on paid tickets: <b>{p.fee}</b></div>
            <div className="muted small">{p.note}</div>
          </div>
        ))}
      </div>

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

      <section>
        <h2>How fees work</h2>
        <p>Platform fees are shown separately from ticket prices. Payment processing charges from the payment provider are separate from our platform fees and still apply.</p>
        <p><b>Example:</b> an organizer sells 500 tickets at $20 each, for $10,000 in ticket sales.</p>
        <ul>
          <li>Starter plan (3%): $300 platform fee</li>
          <li>Pro plan (1.5%): $150 platform fee, plus the $19 monthly price</li>
          <li>Business plan (0.5%): $50 platform fee, plus the $49 monthly price</li>
        </ul>
        <p>Payment provider charges are additional in every case.</p>
      </section>

      <p className="meta">
        <Link href="/terms">Terms</Link> · <Link href="/refunds">Refunds</Link> · <Link href="/privacy">Privacy</Link>
      </p>
    </main>
  );
}
