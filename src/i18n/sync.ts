// After sign-in (S2.3, FR-23.3–23.4): the profile's language and this browser's cookie agree.
// A language saved on the profile wins (it follows the user between devices); otherwise the choice
// this browser made while signed out is saved to the profile.
import { cookies } from "next/headers";
import { api, data } from "@/lib/api/server";
import { languageCookie } from "./actions";
import { languageSyncPlan } from "./sync-plan";
import { LANGUAGE_COOKIE } from "./resolve";

/** Never blocks sign-in: a failure only means the two catch up next time. */
export async function syncLanguageAfterSignIn(): Promise<void> {
  try {
    const jar = await cookies();
    const client = await api();
    const me = data(await client.GET("/v1/me"));
    const plan = languageSyncPlan(me.language, jar.get(LANGUAGE_COOKIE)?.value);
    if (plan.setCookie) jar.set(await languageCookie(plan.setCookie));
    if (plan.saveProfile) await client.PATCH("/v1/me", { body: { language: plan.saveProfile } });
  } catch (error) {
    console.warn(`[i18n] language sync after sign-in skipped: ${(error as Error).message}`);
  }
}
