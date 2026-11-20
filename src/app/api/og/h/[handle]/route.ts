import { proxyShareCard } from "@/lib/share-card";

// A host's profile share card (Change 4 chunk 4, FR-32): /api/og/h/{handle}?v=…&lang=…, the og:image of
// /h/{handle} (src/lib/host-profile.ts profileCardPath). Drawn by gventz-api
// (GET /v1/share-cards/hosts/{handle}.png); an unknown handle is 404 and an old one moves (308) to the
// new handle's card.

export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  let decoded = handle;
  try {
    decoded = decodeURIComponent(handle);
  } catch {
    // A malformed escape: the path check refuses it.
  }
  return proxyShareCard(request, { kind: "host", handle: decoded });
}
