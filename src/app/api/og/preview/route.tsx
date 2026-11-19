// TEMPORARY (local check only, deleted before hand-over).
import { ImageResponse } from "next/og";
import { createTranslator } from "next-intl";
import { loadMessages } from "@/i18n/messages";
import { dirOf, type Locale } from "@/i18n/languages";
import { getTheme } from "@/lib/themes";
import { priceLabel } from "@/lib/price-label";
import { cardDateLine, cardPlace, fitTitle } from "@/lib/og-card";
import { EventCard } from "../card";
import { cardFonts } from "../fonts";
import { flyer } from "../flyer";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const lang = (q.get("lang") ?? "en") as Locale;
  const messages = await loadMessages(lang);
  const t = createTranslator({ locale: lang, messages });
  const title = fitTitle(q.get("title") ?? "Paid Jazz Night");
  const flyerUrl = await flyer(q.get("cover"));
  const place = cardPlace({ kind: "venue", city: q.get("city") ?? "Lagos" }, t("discover.online"));
  const price = priceLabel(q.get("free") ? null : { minor: 500000, currency: "NGN" }, lang, (k, v) => t(`shared.${k}`, v));
  const fonts = await cardFonts({ arabic: lang === "ar" });
  return new ImageResponse(
    <EventCard title={title} dateLine={cardDateLine("2026-11-21T18:00:00Z", "Africa/Lagos", lang)} place={place} price={price}
      host={{ label: t("event.page.hostedBy"), name: q.get("host") ?? "Ada Lovelace" }} flyer={flyerUrl}
      cover={{ background: getTheme(q.get("theme")).background, grad: getTheme(q.get("theme")).grad }} rtl={dirOf(lang) === "rtl"} />,
    { width: 1200, height: 630, fonts },
  );
}
