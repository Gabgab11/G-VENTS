"use client";

// Last resort when the root layout itself fails. It replaces the whole document,
// so it can't rely on the app's stylesheet.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#141414", color: "#fff", fontFamily: "system-ui, sans-serif", padding: 32 }}>
        <h1>Something went wrong</h1>
        <p>G-vents couldn&apos;t load. Please try again.</p>
        <button type="button" onClick={reset} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 999 }}>Try again</button>
      </body>
    </html>
  );
}
