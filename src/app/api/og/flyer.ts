import "server-only";

import { dataUrl, flyerType } from "@/lib/og-card";

// The event's flyer for its share card (D81). Fetched with a short timeout and handed to the
// renderer as a data URL. Only JPEG and PNG can be drawn; WebP, anything else, a slow or failed
// download, or a file over the size limit gives null, and the card shows the cover style instead.

const FLYER_TIMEOUT_MS = 2_500;
const FLYER_MAX_BYTES = 6 * 1024 * 1024;

/** The flyer as a data URL when it is a JPEG or PNG that arrives in time; otherwise null (cover style). */
export async function flyer(coverUrl: string | null): Promise<string | null> {
  if (!coverUrl) return null;
  try {
    const url = new URL(coverUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(FLYER_TIMEOUT_MS), headers: { accept: "image/jpeg,image/png" } });
    if (!res.ok) return null;
    if (Number(res.headers.get("content-length") ?? 0) > FLYER_MAX_BYTES) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > FLYER_MAX_BYTES) return null;
    const type = flyerType(bytes);
    return type ? dataUrl(bytes, type) : null;
  } catch {
    return null;
  }
}
