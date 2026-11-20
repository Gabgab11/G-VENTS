import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { api, data } from "@/lib/api/server";
import { env } from "@/lib/env";
import ProfileForm from "./ProfileForm";
import ProfileImages from "./ProfileImages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile.settings");
  return { title: `${t("title")} · G-ventZ` };
}

// Settings → Profile (Change 4 chunk 4, FR-32): the handle with a live check, the public details and
// links, and the avatar and cover. The settings layout gives the page header and tabs.
export default async function ProfileSettingsPage() {
  const client = await api();
  const [profile, me] = await Promise.all([client.GET("/v1/me/profile").then(data), client.GET("/v1/me").then(data)]);
  const site = env.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <>
      <ProfileImages name={me.fullName?.trim() || profile.handle || ""} avatarUrl={profile.avatarUrl} coverUrl={profile.coverUrl} />
      <ProfileForm
        ownId={profile.id}
        site={site}
        initial={{
          handle: profile.handle ?? "",
          name: me.fullName ?? "",
          bio: profile.bio ?? "",
          location: profile.location ?? "",
          instagram: profile.socials.instagram ?? "",
          facebook: profile.socials.facebook ?? "",
          x: profile.socials.x ?? "",
          website: profile.socials.website ?? "",
        }}
      />
    </>
  );
}
