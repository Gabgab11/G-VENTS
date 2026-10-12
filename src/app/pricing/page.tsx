import BackLink from "@/components/BackLink";

export const metadata = { title: "Pricing · G-vents" };

export default function Page() {
  return (
    <main className="wrap page">
      <div className="back-row"><BackLink fallback="/" label="← Back" /></div>
      <h1>Pricing</h1>
      <p className="muted">G-vents pricing will be published before paid tickets launch.</p>
    </main>
  );
}
