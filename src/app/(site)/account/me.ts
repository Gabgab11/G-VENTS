import type { components } from "@/lib/api/schema";
import type { EmailPreferences, Gender } from "./account-input";

// GET /v1/me and PATCH /v1/me as the account page uses them (D93): the generated contract plus the
// account page's fields, so the page builds whichever version of the API types is checked in.

export type AccountMe = components["schemas"]["MeDto"] & {
  avatarUrl?: string | null;
  handle?: string | null;
  isHost?: boolean;
  verified?: boolean;
  emailPreferences?: Partial<EmailPreferences> | null;
};

export type MePatch = components["schemas"]["UpdateMeDto"] & {
  phone?: string | null;
  gender?: Gender | null;
  avatarPath?: string | null;
  emailPreferences?: Partial<EmailPreferences>;
};
