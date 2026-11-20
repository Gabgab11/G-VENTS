import { proxyShareCard } from "@/lib/share-card";

// The site's default share card (Change 4, D81): /api/og/site?lang={lang}, used by the root metadata
// for the home page, Discover and other pages without their own card. Drawn by gventz-api
// (GET /v1/share-cards/site.png).

export async function GET(request: Request) {
  return proxyShareCard(request, { kind: "site" });
}
