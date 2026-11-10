import "server-only";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";

// The unsubscribe link in announcement emails (C2). The token is the only credential, so the
// call is anonymous: no session needed, and it works from any device.

export const isUnsubscribeToken = (value: string) => /^[0-9a-f]{32}$/.test(value);

export type UnsubscribeResult = { ok: true; eventTitle: string } | { ok: false; reason: "unknown" | "failed" };

export async function unsubscribe(token: string): Promise<UnsubscribeResult> {
  if (!isUnsubscribeToken(token)) return { ok: false, reason: "unknown" };
  try {
    const result = data(await (await api({ anonymous: true })).POST("/v1/unsubscribe", { body: { token } }));
    return { ok: true, eventTitle: result.eventTitle };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { ok: false, reason: "unknown" };
    console.error("[unsubscribe]", error);
    return { ok: false, reason: "failed" };
  }
}
