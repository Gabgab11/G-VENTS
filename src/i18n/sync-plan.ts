// What to do after sign-in so the profile's language and this browser's cookie agree (S2.3).
import { enabledLanguages, isEnabled, isLanguage, type Language, type Locale } from "./languages";

export type SyncPlan = { setCookie?: Language; saveProfile?: Language };

export function languageSyncPlan(saved: unknown, cookie: unknown, enabled: readonly Locale[] = enabledLanguages()): SyncPlan {
  if (isLanguage(saved)) {
    // A saved language that is switched off here (e.g. before release) leaves this browser alone.
    return isEnabled(saved, enabled) && saved !== cookie ? { setCookie: saved } : {};
  }
  return isLanguage(cookie) && isEnabled(cookie, enabled) ? { saveProfile: cookie } : {};
}
