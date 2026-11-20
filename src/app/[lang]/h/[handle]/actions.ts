"use server";

import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import { isUuid } from "@/lib/forms";

// Follow and unfollow a host (FR-32): PUT / DELETE /v1/hosts/{id}/follow. Both are idempotent, so a
// repeated click can't double-count; the API rate-limits them and answers with the new state.

export type FollowResult =
  | { ok: true; following: boolean; followerCount: number }
  | { ok: false; reason: "signIn" | "self" | "failed" };

export async function setFollowing(hostId: string, follow: boolean): Promise<FollowResult> {
  if (!isUuid(hostId)) return { ok: false, reason: "failed" };
  try {
    const client = await api();
    const params = { params: { path: { id: hostId } } };
    const state = data(await (follow ? client.PUT("/v1/hosts/{id}/follow", params) : client.DELETE("/v1/hosts/{id}/follow", params)));
    return { ok: true, following: state.following, followerCount: state.followerCount };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { ok: false, reason: "signIn" };
    if (error instanceof ApiError && error.code === "host.cannot_follow_self") return { ok: false, reason: "self" };
    if (!(error instanceof ApiError) || error.status >= 500) console.error("[follow]", error);
    return { ok: false, reason: "failed" };
  }
}
