// Where to send someone after they sign in. Only same-site paths are allowed:
// anything else (other sites, "//host", "javascript:", backslash tricks) falls back to My tickets (D82: after sign-in, back where you were going, else My tickets).
export function safeNextPath(raw: string | null | undefined, fallback = "/my-tickets"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  // Reject control characters, which some browsers strip before parsing.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  try {
    const url = new URL(raw, "https://g-vents.invalid");
    if (url.origin !== "https://g-vents.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
