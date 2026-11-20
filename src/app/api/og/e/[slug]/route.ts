import { proxyShareCard } from "@/lib/share-card";

// The event's share card (Change 4, FR-29.1, D81): /api/og/e/{slug}?v={updatedAt}&lang={lang}, the
// og:image of every event page (src/lib/share.ts shareCardPath). Drawn by gventz-api
// (GET /v1/share-cards/events/{slug}.png); only published public events have one, anything else is 404.

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return proxyShareCard(request, { kind: "event", slug });
}
