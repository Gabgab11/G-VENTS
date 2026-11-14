import Link from "next/link";
import { api } from "@/lib/api/server";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/admin";
import { acceptStaffInvite } from "../actions";
import Notice from "../Notice";

// Accepting an invitation to G-ventZ staff (FR-21.7). The invitation belongs to one email: the
// visitor must be signed in with exactly that (verified) address. After accepting they set up
// two-step sign-in, which the admin dashboard requires.
export default async function StaffInvitePage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireUser("/admin/invite");
  const invite = await (await api()).GET("/v1/me/staff-invite").then((r) => r.data ?? null).catch(() => null);

  if (!invite) {
    return (
      <section className="panel stack">
        <div className="panel-label">No invitation found</div>
        <p>There is no open G-ventZ staff invitation for <b>{user.email}</b>.</p>
        <p className="muted small">Invitations are for one email address and expire after 7 days. If you were invited at another address, sign out and sign in with that one, or ask the person who invited you to send a new invitation.</p>
        <Link href="/dashboard" className="btn-ghost">Go to your dashboard</Link>
      </section>
    );
  }

  return (
    <section className="panel stack">
      <Notice err={sp.err} />
      <div className="panel-label">You&apos;re invited</div>
      <h2 className="ad-h2">Join the G-ventZ team</h2>
      <p>
        {invite.invitedBy ? <><b>{invite.invitedBy.name || invite.invitedBy.email}</b> invited</> : "You were invited"} <b>{user.email}</b> to become G-ventZ staff,
        with access to the admin dashboard: every event, host and order on the platform, and its settings.
      </p>
      <p className="muted small">The invitation expires {formatDate(invite.expiresAt, true)}. After accepting, you&apos;ll set up two-step sign-in (a passkey or an authenticator app); the dashboard needs it.</p>
      <form action={acceptStaffInvite}>
        <button type="submit" className="btn-grad">Accept invitation</button>
      </form>
    </section>
  );
}
