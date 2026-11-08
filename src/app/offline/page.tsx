import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "You're offline · G-ventZ", robots: { index: false } };

// Shown by the service worker (public/sw.js) when a page can't load without a connection.
export default function OfflinePage() {
  return (
    <main className="offline">
      <div className="offline-card">
        <p className="si-eyebrow">No connection</p>
        <h1 className="si-title">You&apos;re offline</h1>
        <p className="si-sub">Check your connection and try again. Tickets you&apos;ve opened on this phone before still work offline: open them from the link in your email.</p>
        <Link href="/my-tickets" className="si-primary offline-btn">Try again</Link>
      </div>
    </main>
  );
}
