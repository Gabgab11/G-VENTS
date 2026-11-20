"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { inviteProblem, isInviteToken, landingPath } from "@/app/(site)/host/events/[id]/team-roles";

// Accepting a team invitation (Change 4 chunk 5, D77). The API adds the signed-in person when their
// confirmed email is the invited one; door staff then land on the scanner, others on the workspace.

const page = (token: string) => `/team-invites/${token}`;

export async function acceptInvite(token: string) {
  if (!isInviteToken(token)) redirect("/host");
  let target: string;
  try {
    const accepted = data(await (await api()).POST("/v1/team-invites/{token}/accept", { params: { path: { token } } }));
    target = landingPath(accepted);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(`/sign-in?next=${encodeURIComponent(page(token))}`);
    const code = error instanceof ApiError ? error.code : undefined;
    if (!(error instanceof ApiError) || error.status >= 500) console.error("[team-invites] accept", error);
    redirect(`${page(token)}?err=${inviteProblem(code)}`);
  }
  revalidatePath("/host", "layout");
  redirect(target);
}

/** "Switch account": signs out and comes back to this invitation through sign-in. */
export async function switchAccount(token: string) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(`/sign-in?next=${encodeURIComponent(isInviteToken(token) ? page(token) : "/host")}`);
}
