import Link from "next/link";
import ColorModeToggle from "@/components/ColorModeToggle";
import { can, requireEvent } from "@/lib/auth";
import { env } from "@/lib/env";
import ThemeStage from "@/components/ThemeStage";
import BackLink from "@/components/BackLink";
import ThemePanel from "../ThemePanel";
import { getDashboardTheme } from "../getTheme";
import OverviewTab from "./OverviewTab";
import GuestsTab, { type GuestQuery } from "./GuestsTab";
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

// The event dashboard, from gventz-api (U6b). Only the event's team gets here (others: 404);
// controls show according to the caller's permissions, and the API checks them again.
export default async function ManageEventPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; ok?: string; err?: string } & GuestQuery>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: TabKey = TABS.find((t) => t.key === sp.tab)?.key ?? "overview";

  const [event, theme] = await Promise.all([requireEvent(id), getDashboardTheme()]);

  const url = `${env.siteUrl}/e/${event.slug}`;
  const ok = messageFor(sp.ok);
  const err = messageFor(sp.err);
  const statusLabel = event.status === "draft" ? "Draft" : event.status === "cancelled" ? "Cancelled" : "Published";

  return (
    <main className="wrap page wide stage-content">
      <ThemeStage theme={theme} />
      <div className="back-row spread"><BackLink fallback="/dashboard" label="← All events" /><ColorModeToggle /></div>
      <h1>{event.title}</h1>
      <p className="muted small">{statusLabel} · {event.visibility === "private" ? "Private" : "Public"} · You are {event.role}</p>
      {event.status === "published" && can(event, "guests.checkIn") && (
        <p><Link href={`/dashboard/${id}/scan`} className="btn-grad">Scan tickets at the door</Link></p>
      )}

      <nav className="tabs" aria-label="Event sections">
        {TABS.map((t) => (
          <Link key={t.key} href={`/dashboard/${id}?tab=${t.key}`} className={tab === t.key ? "on" : ""}
            aria-current={tab === t.key ? "page" : undefined}>{t.label}</Link>
        ))}
      </nav>

      <ThemePanel current={theme} />

      {ok && <p className="ok" role="status">{ok}</p>}
      {err && <p className="error" role="alert">{err}</p>}

      {tab === "overview" && <OverviewTab event={event} url={url} />}
      {tab === "guests" && <GuestsTab event={event} query={sp} />}
      {tab === "registration" && <RegistrationTab event={event} url={url} />}
      {tab === "announcements" && <AnnouncementsTab event={event} />}
      {tab === "settings" && <SettingsTab event={event} />}
    </main>
  );
}
