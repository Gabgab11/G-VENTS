import { api, data } from "@/lib/api/server";
import { can, type EventDashboard } from "@/lib/auth";
import { env } from "@/lib/env";
import { Banner } from "@/design";
import { getTranslations } from "next-intl/server";
import AnnouncementComposer from "./AnnouncementComposer";
import { TEMPLATES, isTemplate, type TemplateId } from "./announce";

// Announcements (C2; templates from Change 4 chunk 5). The host picks a template or a blank
// message, writes their text, chooses the audience and sends after confirming the count. The free
// plan's allowance is shown, and Send is off when it is used up; the API enforces it again.
export default async function AnnouncementsTab({ event }: { event: EventDashboard }) {
  const id = event.id;
  const t = await getTranslations("dashboard.announcements");
  const client = await api();
  const [past, allowance, templates] = await Promise.all([
    client.GET("/v1/events/{id}/announcements", { params: { path: { id } } }).then(data),
    client.GET("/v1/events/{id}/announcements/allowance", { params: { path: { id } } }).then(data),
    // The templates the API offers now (the website holds their labels); the known list if unavailable.
    client.GET("/v1/announcement-templates").then(data).then((list) => list.map((x) => x.id).filter(isTemplate)).catch((): TemplateId[] => [...TEMPLATES]),
  ]).catch((error: Error) => {
    console.error(`[host/events] announcements: ${error.message}`);
    return [null, null, null] as const;
  });
  if (!past || !allowance || !templates) return <Banner tone="danger" title={t("loadFailed")} />;

  return (
    <AnnouncementComposer
      eventId={id}
      eventTitle={event.title}
      eventUrl={`${env.siteUrl}/e/${event.slug}`}
      startsAt={event.startsAt}
      endsAt={event.endsAt}
      timeZone={event.timeZone}
      published={event.status === "published"}
      started={new Date(event.startsAt).getTime() <= Date.now()}
      canDraft={can(event, "announcements.draft")}
      canSend={can(event, "announcements.send")}
      allowance={allowance}
      templates={templates}
      past={past}
    />
  );
}
