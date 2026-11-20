import { getLocale, getTranslations } from "next-intl/server";
import { api, data } from "@/lib/api/server";
import type { EventDashboard } from "@/lib/auth";
import { env } from "@/lib/env";
import { localizedPath } from "@/i18n/routing";
import type { Locale } from "@/i18n/languages";
import { Banner } from "@/design";
import DiscountCodes from "./DiscountCodes";
import type { DiscountCode } from "./promote-form";

// Promote (Change 4 chunk 5, FR-33): the event's discount codes. Owner and co-hosts (event.fees);
// codes apply to paid ticket types only.
export default async function PromoteTab({ event }: { event: EventDashboard }) {
  const [t, lang] = await Promise.all([getTranslations("dashboard.promote"), getLocale() as Promise<Locale>]);
  let codes: DiscountCode[] | null;
  try {
    codes = data(await (await api()).GET("/v1/events/{id}/discount-codes", { params: { path: { id: event.id } } })).items;
  } catch (error) {
    console.error(`[host/events] discount codes: ${(error as Error).message}`);
    codes = null;
  }
  if (!codes) return <Banner tone="danger" title={t("loadFailed")} />;

  const paid = event.ticketTypes.filter((tt) => tt.priceMinor > 0);
  return (
    <DiscountCodes
      eventId={event.id}
      codes={codes}
      ticketTypes={paid.map((tt) => ({ id: tt.id, name: tt.name }))}
      currency={paid[0]?.currency ?? event.ticketTypes[0]?.currency ?? "NGN"}
      timeZone={event.timeZone}
      origin={env.siteUrl}
      eventPath={localizedPath(`/e/${encodeURIComponent(event.slug)}`, lang)}
      published={event.status === "published"}
    />
  );
}
