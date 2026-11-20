import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AtSign, CalendarClock, CalendarPlus, Camera, Globe, MapPin, Users } from "lucide-react";
import { withAlternates } from "@/i18n/seo";
import { localizedPath } from "@/i18n/routing";
import type { Locale } from "@/i18n/languages";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cardVersion, profileCardPath, profileOutcome, profilePath, socialDisplay, SOCIAL_FIELDS, type SocialField } from "@/lib/host-profile";
import { asEventCard, loadHostProfile, profileCursor, profileTab, type HostProfile } from "@/lib/host-profile-server";
import { profileMetadata } from "@/lib/profile-metadata";
import SiteHeader from "@/components/SiteHeader";
import ShareButton from "@/components/ShareButton";
import { Avatar, Badge, Button, EmptyState, TabLink, TabLinks } from "@/design";
import EventTile from "../../discover/EventTile";
import { FollowButton, FollowerCount, FollowProvider } from "./FollowControls";
import "../../discover/discover.css";
import s from "./Profile.module.css";

// A host's public profile (Change 4 chunk 4, FR-32): cover, avatar, name and verified badge, handle,
// place, followers, bio and links; Share and Follow; then their public events, upcoming or past, as
// Discover tiles. One API call per request (GET /v1/hosts/{handle}), shared by the metadata and the
// page. The metadata resolves before anything streams (no loading.tsx above this page), so an unknown
// handle is a real 404 and an old one a real 308 to the new address in the same language.

type Params = Promise<{ lang: string; handle: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

function decoded(handle: string): string {
  try {
    return decodeURIComponent(handle);
  } catch {
    return handle;
  }
}

/** The profile for this request, or the 404 / 308 it calls for. */
async function resolve(params: Params, searchParams: Search): Promise<{ profile: HostProfile; lang: Locale; cursor?: string }> {
  const [{ lang, handle }, query] = await Promise.all([params, searchParams]);
  const tab = profileTab(query.tab);
  const cursor = profileCursor(query.cursor);
  const profile = await loadHostProfile(decoded(handle), tab, cursor);
  const outcome = profileOutcome(profile, handle);
  if (outcome.kind === "notFound" || !profile) notFound();
  if (outcome.kind === "redirect") permanentRedirect(`${localizedPath(profilePath(outcome.handle), lang as Locale)}${tab === "past" ? "?tab=past" : ""}`);
  return { profile, lang: lang as Locale, cursor };
}

const displayName = (p: HostProfile) => p.name?.trim() || `@${p.handle}`;
const cardOf = (p: HostProfile, lang: Locale) =>
  profileCardPath(p.handle, cardVersion([p.name, p.avatarUrl, p.coverUrl, p.verified, p.events.upcomingCount, p.events.tab === "upcoming" ? p.events.items[0]?.id : null]), lang);

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { profile, lang, cursor } = await resolve(params, searchParams);
  const [t, { alternates }] = await Promise.all([getTranslations({ locale: lang, namespace: "profile.page" }), withAlternates(params, profilePath(profile.handle))]);
  const name = displayName(profile);
  return profileMetadata({
    title: t("metaTitle", { name, handle: profile.handle }),
    bio: profile.bio,
    fallbackDescription: t("metaDescription", { name }),
    lang,
    url: `${env.siteUrl}${localizedPath(profilePath(profile.handle), lang)}`,
    imageUrl: `${env.siteUrl}${cardOf(profile, lang)}`,
    imageAlt: name,
    alternates,
    pageOfMore: !!cursor,
  });
}

const SOCIAL_ICON: Record<SocialField, typeof Globe> = { instagram: Camera, facebook: Users, x: AtSign, website: Globe };
// Network names are product names and stay as they are; "Website" is translated.
const SOCIAL_NAME: Record<Exclude<SocialField, "website">, string> = { instagram: "Instagram", facebook: "Facebook", x: "X" };
const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;

export default async function HostProfilePage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { profile: p, lang, cursor } = await resolve(params, searchParams);
  setRequestLocale(lang);
  const [t, shared, supabase] = await Promise.all([getTranslations("profile.page"), getTranslations("shared"), createSupabaseServerClient()]);
  // The session cookie is enough to choose the button; the API verifies the token on each call.
  const { data: { session } } = await supabase.auth.getSession();
  const own = session?.user.id === p.id;

  const name = displayName(p);
  const path = localizedPath(profilePath(p.handle), lang);
  const signInHref = `/sign-in?next=${encodeURIComponent(path)}`;
  const tab = p.events.tab;
  const tabHref = (which: "upcoming" | "past", next?: string) => {
    const q = new URLSearchParams();
    if (which === "past") q.set("tab", "past");
    if (next) q.set("cursor", next);
    const qs = q.toString();
    return qs ? `${path}?${qs}` : path;
  };
  const socials = SOCIAL_FIELDS.flatMap((field) => {
    const url = p.socials[field];
    if (!url || !/^https:\/\//i.test(url)) return [];
    const label = field === "website" ? t("website") : SOCIAL_NAME[field];
    return [{ field, url, label, text: socialDisplay(field, url) ?? label }];
  });

  return (
    <main className={s.page}>
      <SiteHeader back="/discover" />

      <FollowProvider hostId={p.id} following={p.following ?? false} count={p.followerCount} signInHref={signInHref}>
        <section className={s.hero} aria-labelledby="profile-name">
          <div className={s.cover}>
            {/* eslint-disable-next-line @next/next/no-img-element -- profile pictures come from storage at arbitrary sizes */}
            {p.coverUrl && <img src={p.coverUrl} alt={t("coverAlt", { name })} />}
          </div>

          <div className={s.head}>
            <Avatar name={name} src={p.avatarUrl} size={48} className={s.avatar} />
            <div className={s.identity}>
              <h1 id="profile-name" className={s.name}>
                <span>{name}</span>
                {p.verified && <Badge verified className={s.badge}>{shared("hostProfile.verified")}</Badge>}
              </h1>
              <p className={s.meta}>
                <span className={s.metaItem} dir="ltr">@{p.handle}</span>
                {p.location && <span className={s.metaItem}><MapPin size={16} strokeWidth={1.75} aria-hidden />{p.location}</span>}
                <FollowerCount />
              </p>
            </div>
            <div className={s.actions}>
              <ShareButton path={path} title={name} cardUrl={cardOf(p, lang)} variant="button" qr={{ title: name, subtitle: `@${p.handle}` }} />
              {own ? (
                <Button href="/host/settings/profile" variant="secondary">{t("editProfile")}</Button>
              ) : session ? (
                <FollowButton />
              ) : (
                <Button href={signInHref} variant="primary">{t("follow")}</Button>
              )}
            </div>
          </div>

          {p.bio && <p className={s.bio}>{p.bio}</p>}

          {socials.length > 0 && (
            <ul className={s.socials} aria-label={t("socialsLabel", { name })}>
              {socials.map(({ field, url, label, text }) => {
                const Icon = SOCIAL_ICON[field];
                return (
                  <li key={field}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className={s.social} aria-label={text === label ? label : `${label}: ${text}`}>
                      <Icon {...ICON} />
                      <span dir="ltr">{text}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </FollowProvider>

      <section className={s.events} aria-labelledby="profile-events">
        <h2 id="profile-events" className="sr-only">{t("eventsTitle")}</h2>
        <TabLinks aria-label={t("tabsLabel", { name })}>
          <TabLink href={tabHref("upcoming")} active={tab === "upcoming"} count={p.events.upcomingCount.toLocaleString(lang)}>{t("upcoming")}</TabLink>
          <TabLink href={tabHref("past")} active={tab === "past"} count={p.events.pastCount.toLocaleString(lang)}>{t("past")}</TabLink>
        </TabLinks>

        {p.events.items.length > 0 ? (
          <div className="dc-grid">
            {p.events.items.map((e) => <EventTile key={e.id} event={asEventCard(e)} showPrice={false} />)}
          </div>
        ) : tab === "upcoming" ? (
          <EmptyState icon={<CalendarPlus {...ICON} />} title={t("noUpcoming")}>{own ? null : t("noUpcomingHint", { name })}</EmptyState>
        ) : (
          <EmptyState icon={<CalendarClock {...ICON} />} title={t("noPast")} />
        )}

        {(cursor || p.events.nextCursor) && (
          <div className={s.pager}>
            {cursor && <Button href={tabHref(tab)} variant="ghost">{t("first")}</Button>}
            {p.events.nextCursor && <Button href={tabHref(tab, p.events.nextCursor)} variant="secondary">{t("more")}</Button>}
          </div>
        )}
      </section>
    </main>
  );
}
