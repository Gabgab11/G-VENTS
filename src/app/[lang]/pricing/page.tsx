import PricingPlans from "@/components/PricingPlans";
import { withAlternates } from "@/i18n/seo";

export function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  return withAlternates(params, "/pricing", { title: "Pricing · G-ventZ" });
}

export default function PricingPage() {
  return <PricingPlans />;
}
