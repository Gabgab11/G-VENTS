// The host area moved under /host (Change 4 chunk 3, HA1). Old addresses, including links in emails
// already sent, keep working (308, permanent); Next carries the query string over.
export const HOST_REDIRECTS = [
  { source: "/dashboard", destination: "/host", permanent: true },
  { source: "/dashboard/:id/scan", destination: "/host/events/:id/scan", permanent: true },
  { source: "/dashboard/:id/guests.csv", destination: "/host/events/:id/guests.csv", permanent: true },
  { source: "/dashboard/:id", destination: "/host/events/:id", permanent: true },
  { source: "/events/new", destination: "/host/events/new", permanent: true },
  { source: "/account/payouts", destination: "/host/payouts", permanent: true },
  { source: "/account/security", destination: "/host/settings/security", permanent: true },
] as const;

/** Where `path` goes, by the first matching rule (as Next applies them); null when none matches. */
export function redirectFor(path: string): string | null {
  for (const r of HOST_REDIRECTS) {
    const pattern = new RegExp(`^${r.source.replace(/\./g, "\\.").replace(/:id/g, "([^/]+)")}$`);
    const m = pattern.exec(path);
    if (m) return r.destination.replace(":id", m[1] ?? "");
  }
  return null;
}
