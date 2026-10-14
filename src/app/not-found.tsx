import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap page">
      <h1>Page not found</h1>
      <p className="muted">This page doesn&apos;t exist, or you don&apos;t have access to it. If someone sent you a link to an event, check it&apos;s complete.</p>
      <div className="actions">
        <Link href="/discover" className="btn-white">Discover events</Link>
        <Link href="/" className="btn-ghost">Go home</Link>
      </div>
    </main>
  );
}
