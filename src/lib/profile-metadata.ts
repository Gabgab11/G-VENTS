// A host profile's metadata (Change 4 chunk 4, FR-32, FR-24): title, description, the profile's share
// card for Open Graph and Twitter, and the language alternates. Indexable; later pages of events
// ("More events") are left out of search, since the first page is the profile's address.
import type { Metadata } from "next";
import type { Locale } from "@/i18n/languages";
import { clip, ogLocale } from "@/lib/event-metadata";

export type ProfileMetadataInput = {
  title: string;
  bio: string | null;
  /** "Events by {name} on G-ventZ.", when there's no bio. */
  fallbackDescription: string;
  lang: Locale;
  url: string;
  imageUrl: string;
  imageAlt: string;
  alternates?: Metadata["alternates"];
  /** A page after the first ("?cursor="). */
  pageOfMore?: boolean;
};

export function profileMetadata(input: ProfileMetadataInput): Metadata {
  const title = `${input.title} · G-ventZ`;
  const bio = input.bio?.replace(/\s+/g, " ").trim();
  const description = clip(bio || input.fallbackDescription);
  const images = [{ url: input.imageUrl, width: 1200, height: 630, alt: input.imageAlt }];
  return {
    title,
    description,
    ...(input.alternates ? { alternates: input.alternates } : {}),
    openGraph: { type: "profile", url: input.url, title, description, siteName: "G-ventZ", locale: ogLocale(input.lang), images },
    twitter: { card: "summary_large_image", title, description, images },
    ...(input.pageOfMore ? { robots: { index: false, follow: true } } : {}),
  };
}
