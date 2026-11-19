import { ImageResponse } from "next/og";
import { createTranslator } from "next-intl";
import { api, data } from "@/lib/api/server";
import type { EventPage } from "@/lib/event-page";
import { loadMessages } from "@/i18n/messages";
import { dirOf } from "@/i18n/languages";
import { getTheme } from "@/lib/themes";
import { priceLabel } from "@/lib/price-label";
import { CARD_HEIGHT, CARD_WIDTH, cardCacheControl, cardDateLine, cardLanguage, cardPlace, cardPrice, fitTitle, needsArabic } from "@/lib/og-card";
import { EventCard } from "../../card";
import { cardFonts } from "../../fonts";
import { flyer } from "../../flyer";

// The event's share card (Change 4, FR-29.1, D81): /api/og/e/{slug}?v={updatedAt}&lang={lang}.
// 1200×630 PNG with the flyer (or the cover style), title, date, place, price, host and wordmark.
// Only published public events get a card: private, draft, unknown events and API errors answer 404,
// so a private event's details never end up in a publicly cached image. The event is read
// anonymously (no viewer token), so a host's own session can't unlock a draft's card.

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60", "Content-Type": "text/plain; charset=utf-8" } });
}

async function publicEvent(slug: string): Promise<EventPage | null> {
  try {
    const event = data(await (await api({ anonymous: true })).GET("/v1/events/by-slug/{slug}", { params: { path: { slug } } }));
    return event.visibility === "public" && event.status === "published" ? event : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const search = new URL(request.url).searchParams;
  const lang = cardLanguage(search.get("lang"));
  const event = await publicEvent(slug);
  if (!event) return notFound();

  const [messages, flyerUrl] = await Promise.all([loadMessages(lang), flyer(event.coverUrl)]);
  const t = createTranslator({ locale: lang, messages });
  const theme = getTheme(event.coverTheme);
  const title = fitTitle(event.title);
  const place = cardPlace(event.location, t("discover.online"));
  const price = priceLabel(cardPrice(event.ticketTypes), lang, (key, values) => t(`shared.${key}`, values));
  const host = event.hostName ? { label: t("event.page.hostedBy"), name: event.hostName } : null;
  const dateLine = cardDateLine(event.startsAt, event.timeZone, lang);

  const fonts = await cardFonts({ arabic: lang === "ar" || needsArabic(event.title, place, event.hostName) });
  const image = new ImageResponse(
    <EventCard
      title={{ text: title.text, size: title.size }}
      dateLine={dateLine}
      place={place}
      price={price}
      host={host}
      flyer={flyerUrl}
      cover={{ background: theme.background, grad: theme.grad }}
      rtl={dirOf(lang) === "rtl"}
    />,
    { width: CARD_WIDTH, height: CARD_HEIGHT, fonts },
  );
  image.headers.set("Cache-Control", cardCacheControl(search.get("v")));
  return image;
}
