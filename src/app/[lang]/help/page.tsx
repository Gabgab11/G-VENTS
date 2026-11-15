import SiteHeader from "@/components/SiteHeader";
import { withAlternates } from "@/i18n/seo";

export function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  return withAlternates(params, "/help", { title: "Help · G-vents" });
}

export default function Page() {
  return (
    <main className="wrap page">
      <SiteHeader />
      <h1>Help</h1>
      <p className="muted">Guests: contact the organiser of the event you registered for. Organisers: manage your events from your dashboard.</p>
    </main>
  );
}
