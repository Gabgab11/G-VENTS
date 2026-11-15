"use client";

import { useEffect } from "react";
import Link from "next/link";

// Shown when a page fails to load, for example if the database is unreachable.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Lands in the Vercel function/browser logs; swap for an error-monitoring SDK when one is added.
    console.error(error);
  }, [error]);

  return (
    <main className="wrap page">
      <h1>Something went wrong</h1>
      <p className="muted">We couldn&apos;t load this page. Please try again in a moment.</p>
      {error.digest && <p className="muted small">Reference: {error.digest}</p>}
      <div className="actions">
        <button type="button" className="btn-white" onClick={reset}>Try again</button>
        <Link href="/" className="btn-ghost">Go home</Link>
      </div>
    </main>
  );
}
