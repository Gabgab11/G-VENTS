import { getTranslations } from "next-intl/server";
import { api, data } from "@/lib/api/server";
import type { EventDashboard } from "@/lib/auth";
import { Banner } from "@/design";
import ActivityList from "./ActivityList";

const PAGE = 30;

// Activity (Change 4 chunk 5): what happened on the event and who did it, newest first. Roles with
// activity.read; "Load more" follows the API's cursor.
export default async function ActivityTab({ event }: { event: EventDashboard }) {
  const t = await getTranslations("dashboard.activity");
  const page = await (await api())
    .GET("/v1/events/{id}/activity", { params: { path: { id: event.id }, query: { limit: PAGE } } })
    .then(data)
    .catch((error: Error) => {
      console.error(`[host/events] activity: ${error.message}`);
      return null;
    });
  if (!page) return <Banner tone="danger" title={t("loadFailed")} />;
  const currency = event.ticketTypes.find((tt) => tt.priceMinor > 0)?.currency ?? event.ticketTypes[0]?.currency ?? "NGN";
  return <ActivityList eventId={event.id} initial={page.items} nextCursor={page.nextCursor} timeZone={event.timeZone} currency={currency} now={new Date().toISOString()} />;
}
