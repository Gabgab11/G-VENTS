import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEventRole, STAFF_ROLES } from "@/lib/auth";
import { env } from "@/lib/env";
import ThemeStage from "@/components/ThemeStage";
import BackLink from "@/components/BackLink";
import ThemePanel from "../ThemePanel";
import { getDashboardTheme } from "../getTheme";
import OverviewTab from "./OverviewTab";
import GuestsTab from "./GuestsTab";
import RegistrationTab from "./RegistrationTab";
import AnnouncementsTab from "./AnnouncementsTab";
import SettingsTab from "./SettingsTab";
import { messageFor } from "./messages";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "guests", label: "Guests" },
  { key: "registration", label: "Registration" },
  { key: "announcements", label: "Announcements" },
  { key: "settings", label: "Settings" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function ManageEventPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; ok?: string; err?: string; page?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: TabKey = TABS.find((t) => t.key === sp.tab)?.key ?? "overview";

  // Only this event's team gets past here; everyone else sees a 404.
  const { supabase, user } = await requireEventRole(id, STAFF_ROLES);

  const [{ data: event }, theme] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, slug, status, visibility, starts_at, capacity, registration_open, show_attendee_count")
      .eq("id", id)
      .maybeSingle(),
    getDashboardTheme(supabase, user.id),
  ]);
  if (!event) notFound();

  const url = `${env.siteUrl}/e/${event.slug}`;
  const ok = messageFor(sp.ok);
  const err = messageFor(sp.err);
  const statusLabel = event.status === "draft" ? "Draft" : event.status === "cancelled" ? "Cancelled" : "Published";

  return (
    <main className="wrap page wide stage-content">
      <ThemeStage theme={theme} />
      <BackLink fallback="/dashboard" label="← All events" />
      <h1>{event.title}</h1>
      <p className="muted small">{statusLabel} · {event.visibility === "private" ? "Private" : "Public"}</p>

      <nav className="tabs" aria-label="Event sections">
        {TABS.map((t) => (
          <Link key={t.key} href={`/dashboard/${id}?tab=${t.key}`} className={tab === t.key ? "on" : ""}
            aria-current={tab === t.key ? "page" : undefined}>{t.label}</Link>
        ))}
      </nav>

      <ThemePanel current={theme} />

      {ok && <p className="ok" role="status">{ok}</p>}
      {err && <p className="error" role="alert">{err}</p>}

      {tab === "overview" && <OverviewTab id={id} url={url} event={event} />}
      {tab === "guests" && <GuestsTab id={id} page={Number(sp.page) || 1} />}
      {tab === "registration" && <RegistrationTab id={id} url={url} />}
      {tab === "announcements" && <AnnouncementsTab id={id} />}
      {tab === "settings" && <SettingsTab id={id} />}
    </main>
  );
}
