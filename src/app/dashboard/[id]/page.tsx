import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CopyLink from "./CopyLink";
import ThemeStage from "@/components/ThemeStage";
import ThemePanel from "../ThemePanel";
import { getDashboardTheme } from "../getTheme";
import {
  setRegistrationOpen, setCapacity, addQuestion, deleteQuestion,
  checkInGuest, promoteFromWaitlist, createAnnouncement,
} from "./actions";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "guests", label: "Guests" },
  { key: "registration", label: "Registration" },
  { key: "announcements", label: "Announcements" },
] as const;

const KIND_LABEL: Record<string, string> = {
  text: "Short text", options: "Multiple choice", social: "Social profile", company: "Company",
  terms: "Checkbox (terms)", phone: "Phone", website: "Website",
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://g-vents.vercel.app";

export default async function ManageEventPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; ok?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "overview") as (typeof TABS)[number]["key"];

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/dashboard/${id}`);

  const { data: event } = await supabase
    .from("events")
    .select("id, title, slug, status, visibility, starts_at, capacity, registration_open, show_attendee_count")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const theme = await getDashboardTheme(supabase, user.id);
  const url = `${SITE}/e/${event.slug}`;

  return (
    <main className="wrap page wide stage-content">
      <ThemeStage theme={theme} />
      <Link href="/dashboard" className="muted">← All events</Link>
      <h1>{event.title}</h1>
      <p className="muted small">{event.status === "draft" ? "Draft" : "Published"} · {event.visibility === "private" ? "Private" : "Public"}</p>

      <nav className="tabs">
        {TABS.map((t) => (
          <Link key={t.key} href={`/dashboard/${id}?tab=${t.key}`} className={tab === t.key ? "on" : ""}>{t.label}</Link>
        ))}
      </nav>

      <ThemePanel current={theme} />

      {sp.ok && <p className="ok">{sp.ok}</p>}
      {sp.err && <p className="error">{sp.err}</p>}

      {tab === "overview" && <Overview id={id} url={url} event={event} />}
      {tab === "guests" && <Guests id={id} />}
      {tab === "registration" && <RegistrationTab id={id} url={url} />}
      {tab === "announcements" && <Announcements id={id} />}
    </main>
  );
}

async function Overview({ id, url, event }: { id: string; url: string; event: { registration_open: boolean; capacity: number | null; show_attendee_count: boolean } }) {
  const supabase = await createSupabaseServerClient();
  const [{ count: confirmed }, { count: waiting }, { count: checked }] = await Promise.all([
    supabase.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", id).eq("status", "confirmed"),
    supabase.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", id).eq("status", "waitlisted"),
    supabase.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", id).not("checked_in_at", "is", null),
  ]);

  return (
    <div className="stack">
      <div className="stats">
        <div className="stat"><b>{confirmed ?? 0}</b><span>Confirmed</span></div>
        <div className="stat"><b>{waiting ?? 0}</b><span>Waiting list</span></div>
        <div className="stat"><b>{checked ?? 0}</b><span>Checked in</span></div>
        <div className="stat"><b>{event.capacity ?? "∞"}</b><span>Capacity</span></div>
      </div>

      <section className="panel">
        <div className="panel-label">Share your event</div>
        <p className="muted small">Send this link to anyone. Guests register on the event page.</p>
        <CopyLink url={url} />
      </section>

      <section className="panel">
        <div className="spread">
          <div>
            <div className="option-title">Registration</div>
            <div className="muted small">{event.registration_open ? "Open. Guests can register." : "Closed. The register button is hidden."}</div>
          </div>
          <form action={setRegistrationOpen}>
            <input type="hidden" name="event_id" value={id} />
            <input type="hidden" name="open" value={event.registration_open ? "false" : "true"} />
            <button className={event.registration_open ? "btn-ghost" : "btn-grad"} type="submit">
              {event.registration_open ? "Close registration" : "Open registration"}
            </button>
          </form>
        </div>
      </section>

      <section className="panel">
        <div className="option-title">Capacity</div>
        <p className="muted small">Set a limit, such as 200. When it&apos;s full, new guests join the waiting list. Leave blank for unlimited.</p>
        <form action={setCapacity} className="row-form">
          <input type="hidden" name="event_id" value={id} />
          <input className="input" name="capacity" inputMode="numeric" defaultValue={event.capacity ?? ""} placeholder="e.g. 200" />
          <button className="btn-white" type="submit">Save capacity</button>
        </form>
      </section>
    </div>
  );
}

async function Guests({ id }: { id: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("registrations")
    .select("id, attendee_name, attendee_email, status, checked_in_at, answers, created_at, ticket_tiers(name)")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  const waiting = (rows ?? []).filter((r) => r.status === "waitlisted").length;

  return (
    <div className="stack">
      <div className="spread">
        <p className="muted small">{rows?.length ?? 0} registrations · {waiting} waiting</p>
        {waiting > 0 && (
          <form action={promoteFromWaitlist}>
            <input type="hidden" name="event_id" value={id} />
            <button className="btn-small" type="submit">Confirm next waiting guest</button>
          </form>
        )}
      </div>

      {(rows ?? []).length === 0 && <p className="muted">No registrations yet. Share the link to get guests.</p>}

      {(rows ?? []).map((r) => {
        const tier = (r.ticket_tiers as unknown as { name: string } | null)?.name ?? "";
        const answers = Object.values((r.answers ?? {}) as Record<string, { label: string; value: string }>);
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
                  <button className="btn-small" type="submit">Check in</button>
                </form>
              )}
              {r.checked_in_at && <span className="muted small">Checked in</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

async function RegistrationTab({ id, url }: { id: string; url: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: questions } = await supabase
    .from("event_questions")
    .select("id, label, kind, options, required")
    .eq("event_id", id)
    .order("position", { ascending: true });

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-label">Guests fill in</div>
        <div className="q-row"><b>Name</b><span className="muted small">Required</span></div>
        <div className="q-row"><b>Email</b><span className="muted small">Required</span></div>
        <div className="q-row"><b>Ticket</b><span className="muted small">Chosen on the event page</span></div>
        {(questions ?? []).map((q) => (
          <div className="q-row" key={q.id}>
            <span><b>{q.label}</b> <span className="muted small">· {KIND_LABEL[q.kind]}{q.kind === "options" ? `: ${q.options.join(", ")}` : ""}</span></span>
            <span className="q-actions">
              <span className="muted small">{q.required ? "Required" : "Optional"}</span>
              <form action={deleteQuestion}>
                <input type="hidden" name="event_id" value={id} />
                <input type="hidden" name="question_id" value={q.id} />
                <button className="link-btn" type="submit">Remove</button>
              </form>
            </span>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="panel-label">Add a question</div>
        <form action={addQuestion} className="form">
          <input type="hidden" name="event_id" value={id} />
          <label className="field"><span>Question</span>
            <input className="input" name="label" placeholder="e.g. Which church do you attend?" /></label>
          <label className="field"><span>Type</span>
            <select className="input" name="kind" defaultValue="text">
              {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          <label className="field"><span>Options (for multiple choice, one per line)</span>
            <textarea className="input" name="options" rows={3} placeholder={"Adult\nYouth\nChild"} /></label>
          <label className="check"><input type="checkbox" name="required" /> <span>Required</span></label>
          <button className="btn-white" type="submit">Add question</button>
        </form>
      </section>

      <p className="muted small">Registration link: <span className="gold">{url}</span></p>
    </div>
  );
}

async function Announcements({ id }: { id: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: past } = await supabase
    .from("email_campaigns")
    .select("id, subject, segment, status, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-label">New announcement</div>
        <form action={createAnnouncement} className="form">
          <input type="hidden" name="event_id" value={id} />
          <label className="field"><span>Send to</span>
            <select className="input" name="segment" defaultValue="all">
              <option value="all">Everyone registered</option>
              <option value="paid">Paid tickets only</option>
              <option value="checked_in">Checked in</option>
              <option value="not_checked_in">Not checked in yet</option>
              <option value="waitlist">Waiting list</option>
            </select></label>
          <label className="field"><span>Subject</span>
            <input className="input" name="subject" placeholder="Doors open at 5:30 PM" /></label>
          <label className="field"><span>Message</span>
            <textarea className="input" name="body" rows={6} placeholder="Hi {{first_name}}, see you on {{event_date}}." /></label>
          <button className="btn-white" type="submit">Save announcement</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-label">Previous announcements</div>
        {(past ?? []).length === 0 && <p className="muted small">None yet.</p>}
        {(past ?? []).map((a) => (
          <div className="q-row" key={a.id}>
            <span><b>{a.subject}</b> <span className="muted small">· {a.segment.replace("_", " ")}</span></span>
            <span className="muted small">{a.status}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
