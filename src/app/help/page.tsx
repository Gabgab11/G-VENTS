import BackLink from "@/components/BackLink";

export const metadata = { title: "Help · G-vents" };

export default function Page() {
  return (
    <main className="wrap page">
      <div className="back-row"><BackLink fallback="/" label="← Back" /></div>
      <h1>Help</h1>
      <p className="muted">Guests: contact the organiser of the event you registered for. Organisers: manage your events from your dashboard.</p>
    </main>
  );
}
