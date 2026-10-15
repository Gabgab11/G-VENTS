import Link from "next/link";
import BackLink from "@/components/BackLink";

export type LegalSection = { title: string; paragraphs?: string[]; bullets?: string[]; after?: string[] };

// Shared layout for the Terms and Refund pages. Works on phones: single column, readable text size.
export default function LegalDoc({
  title, effective, intro, sections,
}: { title: string; effective: string; intro?: string; sections: LegalSection[] }) {
  return (
    <main className="wrap page legal">
      <div className="back-row"><BackLink fallback="/" label="← Back" /></div>
      <h1>{title}</h1>
      <p className="meta">Effective date: {effective}</p>
      {intro && <p>{intro}</p>}
      {sections.map((s, i) => (
        <section key={s.title}>
          <h2>{i + 1}. {s.title}</h2>
          {s.paragraphs?.map((p, j) => <p key={j}>{p}</p>)}
          {s.bullets && (
            <ul>
              {s.bullets.map((b, j) => <li key={j}>{b}</li>)}
            </ul>
          )}
          {s.after?.map((p, j) => <p key={`a${j}`}>{p}</p>)}
        </section>
      ))}
      <p className="meta">
        <Link href="/terms">Terms</Link> · <Link href="/refunds">Refunds</Link> · <Link href="/pricing">Pricing</Link> · <Link href="/privacy">Privacy</Link>
      </p>
    </main>
  );
}
