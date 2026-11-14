import SiteHeader from "@/components/SiteHeader";

export const metadata = { title: "Help · G-vents" };

export default function Page() {
  return (
    <main className="wrap page">
      <SiteHeader />
      <h1>Help</h1>
      <p className="muted">Guests: contact the organiser of the event you registered for. Organisers: manage your events from your dashboard.</p>
    </main>
  );
}
