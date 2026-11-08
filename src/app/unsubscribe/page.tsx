import type { Metadata } from "next";
import { isUnsubscribeToken } from "@/lib/unsubscribe";
import UnsubscribeForm from "./UnsubscribeForm";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const token = String((await searchParams).t ?? "").toLowerCase();
  return (
    <main className="auth-wrap">
      <div className="auth-card">
        {isUnsubscribeToken(token) ? (
          <UnsubscribeForm token={token} />
        ) : (
          <>
            <h1 className="auth-title">Link not valid</h1>
            <p className="muted">Use the unsubscribe link at the bottom of the email.</p>
          </>
        )}
      </div>
    </main>
  );
}
