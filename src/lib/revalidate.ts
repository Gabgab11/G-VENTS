import { createHmac, timingSafeEqual } from "node:crypto";

// Checks page-refresh calls from gventz-api (U5 business-rules §4): hex HMAC-SHA256 of
// `{timestamp}.{body}` with REVALIDATE_SECRET, at most 5 minutes old. Mirrors the API's
// verifyRevalidation; only the website's public pages may be refreshed.

export const MAX_SKEW_SECONDS = 300;
const ALLOWED_PATH = /^\/(?:|discover|e\/[a-z0-9-]{1,120})$/;

export function verifySignature(secret: string, body: string, timestamp: number, signature: string, nowSeconds: number): boolean {
  if (secret.length < 32 || !Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > MAX_SKEW_SECONDS) return false;
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

/** The paths to refresh, or null when the body isn't `{ paths: [...] }` with allowed paths only. */
export function allowedPaths(body: string): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const paths = (parsed as { paths?: unknown })?.paths;
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > 20) return null;
  return paths.every((p) => typeof p === "string" && ALLOWED_PATH.test(p)) ? (paths as string[]) : null;
}
