import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkInGuest, promoteFromWaitlist } from "./actions";

const PAGE_SIZE = 50;

type Answer = { label: string; value: string };

export default async function GuestsTab({ id, page }: { id: string; page: number }) {
  const supabase = await createSupabaseServerClient();
  const current = Math.max(1, Math.floor(page));
  const from = (current - 1) * PAGE_SIZE;

  const [{ data: rows, count: total }, { count: waiting }] = await Promise.all([
    supabase
      .from("registrations")
      .select("id, attendee_name, attendee_email, status, checked_in_at, answers, created_at, ticket_tiers(name)", { count: "exact" })
      .eq("event_id", id)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1),
    supabase.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", id).eq("status", "waitlisted"),
  ]);

  const pages = Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE));
  const pageHref = (p: number) => `/dashboard/${id}?tab=guests&page=${p}`;

  return (
    <div className="stack">
      <div className="spread">
        <p className="muted small">{total ?? 0} registrations · {waiting ?? 0} waiting</p>
        {(waiting ?? 0) > 0 && (
          <form action={promoteFromWaitlist}>
            <input type="hidden" name="event_id" value={id} />
            <button className="btn-small" type="submit">Confirm next waiting guest</button>
          </form>
        )}
      </div>

      {(rows ?? []).length === 0 && <p className="muted">No registrations yet. Share the link to get guests.</p>}

      {(rows ?? []).map((r) => {
        const tier = (r.ticket_tiers as unknown as { name: string } | null)?.name ?? "";
        const answers = Object.values((r.answers ?? {}) as Record<string, Answer>);
        return (
          <div className="guest-row" key={r.id}>
            <div className="guest-main">
              <b>{r.attendee_name}</b>
              <div className="muted small">{r.attendee_email} · {tier}</div>
              {answers.map((a, i) => (
                <div className="muted small" key={i}>{a.label}: {a.value}</div>
              ))}
            </div>
            <div className="guest-side">
              <span className={`tag tag-${r.status}`}>{r.status === "waitlisted" ? "Waiting list" : r.status}</span>
              {r.status === "confirmed" && !r.checked_in_at && (
                <form action={checkInGuest}>
                  <input type="hidden" name="event_id" value={id} />
                  <input type="hidden" name="registration_id" value={r.id} />
                  <button className="btn-small" type="submit" aria-label={`Check in ${r.attendee_name}`}>Check in</button>
                </form>
              )}
              {r.checked_in_at && <span className="muted small">Checked in</span>}
            </div>
          </div>
        );
      })}

      {pages > 1 && (
        <nav className="spread" aria-label="Guest list pages">
          {current > 1 ? <Link href={pageHref(current - 1)} className="btn-small">← Previous</Link> : <span />}
          <span className="muted small">Page {current} of {pages}</span>
          {current < pages ? <Link href={pageHref(current + 1)} className="btn-small">Next →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
