import { ImageResponse } from "next/og";
import { createTranslator } from "next-intl";
import { loadMessages } from "@/i18n/messages";
import { dirOf } from "@/i18n/languages";
import { CARD_HEIGHT, CARD_WIDTH, cardCacheControl, cardLanguage, needsArabic } from "@/lib/og-card";
import { SiteCard } from "../card";
import { cardFonts } from "../fonts";
import type homeEn from "../../../../../messages/en/home.json";

// The site's default share card (Change 4, Step 5): /api/og/site?lang={lang}, used by the root
// metadata for the home page, Discover and other pages without their own card.

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const lang = cardLanguage(search.get("lang"));
  const t = createTranslator({ locale: lang, messages: (await loadMessages(lang)) as unknown as { home: typeof homeEn }, namespace: "home.footer" });
  const tagline = t("tagline");
  const fonts = await cardFonts({ arabic: needsArabic(tagline) });
  const image = new ImageResponse(<SiteCard tagline={tagline} rtl={dirOf(lang) === "rtl"} />, { width: CARD_WIDTH, height: CARD_HEIGHT, fonts });
  image.headers.set("Cache-Control", cardCacheControl(search.get("v")));
  return image;
}
