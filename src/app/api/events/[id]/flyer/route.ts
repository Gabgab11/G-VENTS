import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api/problem";
import { apiMessageFor } from "@/lib/api/messages";
import { flyerFrom, uploadFlyer, type FlyerProblem } from "@/lib/flyer";
import { isUuid } from "@/lib/forms";
import { isSameOrigin } from "@/lib/same-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Event flyer upload, outside Server Actions (see src/lib/same-origin.ts for why).
// Two callers:
//   - the dashboard's settings form, a plain HTML form post: answers 303 back to the settings tab
//     with the same ok/err codes the old action used;
//   - the create form, after the event exists: `Accept: application/json`, answers JSON.
// The API still decides who may change the flyer (flyer.manage) and checks the real file type.
export const dynamic = "force-dynamic";

type Outcome = { ok: true } | { ok: false; status: number; code: string };

async function attach(request: Request, id: string): Promise<Outcome> {
  if (!isSameOrigin(request)) return { ok: false, status: 403, code: "failed" };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, code: "signed_out" };
  const form = await request.formData().catch(() => null);
  if (!form) return { ok: false, status: 400, code: "flyer_unreadable" satisfies FlyerProblem };
  const flyer = flyerFrom(form);
  if (!flyer) return { ok: false, status: 400, code: "flyer_missing" satisfies FlyerProblem };
  if ("problem" in flyer) return { ok: false, status: 400, code: flyer.problem };
  try {
    await uploadFlyer(id, flyer.file, flyer.contentType);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status >= 500) console.error(`[flyer] ${error.message}`);
      return { ok: false, status: error.status, code: apiMessageFor(error.code) ? `api.${error.code}` : "failed" };
    }
    console.error(`[flyer] ${(error as Error).message}`);
    return { ok: false, status: 502, code: "failed" };
  }
  console.info(`[flyer] image attached to ${id} (${flyer.contentType}, ${flyer.file.size} bytes)`);
  revalidatePath(`/host/events/${id}`);
  revalidatePath("/host/events");
  return { ok: true };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ ok: false, code: "failed" }, { status: 404 });
  const outcome = await attach(request, id);
  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
  if (wantsJson) {
    return Response.json(outcome.ok ? { ok: true } : { ok: false, code: outcome.code }, { status: outcome.ok ? 200 : outcome.status, headers: { "Cache-Control": "no-store" } });
  }
  const site = new URL(request.url).origin;
  if (!outcome.ok && outcome.code === "signed_out") {
    return Response.redirect(`${site}/sign-in?next=${encodeURIComponent(`/host/events/${id}?tab=settings`)}`, 303);
  }
  const query = outcome.ok ? "ok=flyer_uploaded" : `err=${encodeURIComponent(outcome.code)}`;
  return Response.redirect(`${site}/host/events/${id}?tab=settings&${query}`, 303);
}
