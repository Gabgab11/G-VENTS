import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { requireUser } from "@/lib/auth";
import { mfaState, safeNext, type Method } from "@/lib/mfa";
import { removeFactor } from "./actions";
import { EnrollForm, VerifyForm } from "./MfaForms";
import { AddPasskey, UsePasskey } from "./Passkeys";

export const metadata: Metadata = { title: "Two-step sign-in · G-ventZ", robots: { index: false } };

const added = (m: Method) => new Date(m.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function RemoveButton({ id, label }: { id: string; label: string }) {
  return (
    <form action={removeFactor}>
      <input type="hidden" name="factor_id" value={id} />
      <button type="submit" className="link-btn" aria-label={`Remove ${label}`}>Remove</button>
    </form>
  );
}

// Two-step sign-in (D54): a passkey (Touch ID, Face ID, Windows Hello, a phone or a security key)
// or an authenticator app. With `?next=` it is also the "confirm it's you" step that staff pages
// send people to when the API answers auth.mfa_required.
export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ next?: string; done?: string; removed?: string; err?: string }> }) {
  const sp = await searchParams;
  await requireUser(`/account/security${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`);
  const next = safeNext(sp.next, "/account/security?done=1");
  const { level, factor, passkeys } = await mfaState();
  const confirmed = level === "aal2";
  const hasAny = !!factor || passkeys.length > 0;
  if (confirmed && sp.next) redirect(next);
  const after = sp.next ? next : "/account/security?done=1";

  return (
    <main className="wrap page">
      <SiteHeader back="/dashboard" />
      <h1>Two-step sign-in</h1>
      <p className="muted">
        A second check after your email code, for sensitive areas. Required for G-ventZ staff and recommended for hosts.
        Use a <b>passkey</b> (your fingerprint, face or device PIN) or an <b>authenticator app</b>.
      </p>

      {sp.done && <p className="ok-note" role="status">Two-step sign-in is on and this session is confirmed.</p>}
      {sp.removed && <p className="ok-note" role="status">Removed.</p>}
      {sp.err && <p className="error" role="alert">That couldn&apos;t be removed. Confirm it&apos;s you first, then try again.</p>}

      {/* Not set up yet: offer both, passkey first. */}
      {!hasAny && (
        <>
          <section className="panel stack" aria-labelledby="sec-passkey">
            <div id="sec-passkey" className="panel-label">Passkey (recommended)</div>
            <p className="muted small">Confirm with Touch ID, Face ID, Windows Hello, your phone or a security key. Nothing to type.</p>
            <AddPasskey next={after} />
          </section>
          <section className="panel stack" aria-labelledby="sec-totp">
            <div id="sec-totp" className="panel-label">Authenticator app</div>
            <EnrollForm next={after} />
          </section>
        </>
      )}

      {/* Set up, but this session isn't confirmed yet. */}
      {hasAny && !confirmed && (
        <section className="panel stack" aria-labelledby="sec-confirm">
          <div id="sec-confirm" className="panel-label">Confirm it&apos;s you</div>
          <p className="muted small">Use one of your methods{sp.next ? " to continue" : ""}.</p>
          {passkeys.map((p) => <UsePasskey key={p.id} factorId={p.id} name={p.name} next={after} />)}
          {factor && (
            <>
              {passkeys.length > 0 && <p className="muted small">Or enter the code from your authenticator app:</p>}
              <VerifyForm next={after} />
            </>
          )}
        </section>
      )}

      {/* Confirmed: manage methods. */}
      {hasAny && confirmed && (
        <>
          <section className="panel stack" aria-labelledby="sec-methods">
            <div id="sec-methods" className="panel-label">Your methods</div>
            <ul className="sec-methods">
              {passkeys.map((p) => (
                <li key={p.id}><span><b>{p.name || "Passkey"}</b><span className="muted small"> · passkey · added {added(p)}</span></span><RemoveButton id={p.id} label={p.name || "passkey"} /></li>
              ))}
              {factor && (
                <li><span><b>Authenticator app</b><span className="muted small"> · added {added(factor)}</span></span><RemoveButton id={factor.id} label="authenticator app" /></li>
              )}
            </ul>
            <p className="muted small">This session is confirmed. Keep at least two methods (for example a passkey and the app) so losing one device doesn&apos;t lock you out.</p>
          </section>
          <section className="panel stack" aria-labelledby="sec-add">
            <div id="sec-add" className="panel-label">Add a passkey</div>
            <AddPasskey next="/account/security?done=1" />
          </section>
          {!factor && (
            <section className="panel stack" aria-labelledby="sec-add-totp">
              <div id="sec-add-totp" className="panel-label">Add an authenticator app</div>
              <EnrollForm next="/account/security?done=1" />
            </section>
          )}
        </>
      )}
    </main>
  );
}
