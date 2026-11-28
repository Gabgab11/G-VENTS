"use server";

import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import { isUuid } from "@/lib/forms";
import { unlockCookieName } from "./registration-token";

// Change 6 (FR-40): clear the registration access gate. The guest types one code; we send it as both
// the event and the link code (the API only checks the ones that are required, and ignores the rest),
// get back a short-lived unlock token, and keep it in an httpOnly cookie for this event + link. The
// order path re-verifies the token inside the transaction (fail closed), so the cookie only saves the
// guest from re-typing — it can't by itself bypass the gate.

const TOKEN = /^[A-Za-z0-9_-]{8,128}$/;
const CODE = /^[A-Za-z0-9]{1,64}$/;

export type UnlockResult = { ok: true } | { ok: false; error: string };

export async function unlockRegistration(eventId: string, linkToken: string, code: string): Promise<UnlockResult> {
  const t = await getTranslations("event.access");
  if (!isUuid(eventId) || !TOKEN.test(linkToken)) return { ok: false, error: t("errors.failed") };
  const clean = code.trim();
  if (!CODE.test(clean)) return { ok: false, error: t("errors.code") };
  try {
    const result = data(
      await (await api()).POST("/v1/events/{id}/registration-links/{token}/unlock", {
        params: { path: { id: eventId, token: linkToken } },
        body: { eventCode: clean, linkCode: clean },
      }),
    );
    const store = await cookies();
    store.set(unlockCookieName(eventId, linkToken), result.unlock, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 60, // Matches the unlock token's 30-minute TTL.
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 429) return { ok: false, error: t("errors.tooMany") };
      if (error.status === 400 || error.status === 403 || error.status === 422) return { ok: false, error: t("errors.code") };
    }
    return { ok: false, error: t("errors.failed") };
  }
}
