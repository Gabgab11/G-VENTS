import Link from "next/link";
import RootShell, { baseMetadata, baseViewport } from "@/app/RootShell";

// Addresses that match no page at all (with two root layouts there is no shared not-found).
// English: the address carries no language we could trust.
export const metadata = { ...baseMetadata, title: "Page not found · G-ventZ" };
export const viewport = baseViewport;

export default function GlobalNotFound() {
  return (
    <RootShell lang="en">
      <main className="wrap page">
        <h1>Page not found</h1>
        <p className="muted">This page doesn&apos;t exist, or you don&apos;t have access to it. If someone sent you a link to an event, check it&apos;s complete.</p>
        <div className="actions">
          <Link href="/discover" className="btn-white">Discover events</Link>
          <Link href="/" className="btn-ghost">Go home</Link>
        </div>
      </main>
    </RootShell>
  );
}
