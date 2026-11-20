import "server-only";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";

// The unsubscribe links in announcement emails (C2, `?t=`) and in followed hosts' "new event" emails
// (Change 4 chunk 4, FR-32, `?h=`, which ends that follow). The token is the only credential, so the
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

export type HostUnsubscribeResult = { ok: true; hostName: string | null } | { ok: false; reason: "unknown" | "failed" };

/** Stops a followed host's emails by ending the follow (POST /v1/hosts/unsubscribe). */
export async function unsubscribeHost(token: string): Promise<HostUnsubscribeResult> {
  if (!isUnsubscribeToken(token)) return { ok: false, reason: "unknown" };
  try {
    const result = data(await (await api({ anonymous: true })).POST("/v1/hosts/unsubscribe", { body: { token } }));
    return { ok: true, hostName: result.hostName };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { ok: false, reason: "unknown" };
    console.error("[unsubscribe] host", error);
    return { ok: false, reason: "failed" };
  }
}
