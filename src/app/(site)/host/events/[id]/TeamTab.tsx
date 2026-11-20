import { getTranslations } from "next-intl/server";
import { api, data } from "@/lib/api/server";
import type { EventDashboard } from "@/lib/auth";
import { requireUser } from "@/lib/auth";
import { Banner } from "@/design";
import TeamPanel from "./TeamPanel";
import { sortMembers } from "./team-roles";

// Team (Change 4 chunk 5, D77): co-hosts and door staff. The owner and co-hosts manage it; other
// roles that may see it get the list only. The API decides both.
export default async function TeamTab({ event }: { event: EventDashboard }) {
  const t = await getTranslations("dashboard.team");
  const [{ user }, team] = await Promise.all([
    requireUser(`/host/events/${event.id}?tab=team`),
    (await api()).GET("/v1/events/{id}/team", { params: { path: { id: event.id } } }).then(data).catch((error: Error) => {
      console.error(`[host/events] team: ${error.message}`);
      return null;
    }),
  ]);
  if (!team) return <Banner tone="danger" title={t("loadFailed")} />;
  return (
    <TeamPanel
      eventId={event.id}
      eventTitle={event.title}
      members={sortMembers(team.members)}
      invites={team.invites}
      canManage={team.canManage}
      selfId={user.id}
      timeZone={event.timeZone}
    />
  );
}
