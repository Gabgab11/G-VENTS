import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import { documentFrom } from "@/app/(site)/host/payouts/application-input";
import { isSameOrigin } from "@/lib/same-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The ID or business document for an application to sell paid tickets, uploaded outside Server
// Actions (see src/lib/same-origin.ts for why). Stores the file in the private bucket through a
// signed URL from the API and answers its path; the application form then sends the path with the
// rest of the application (applyToSell). The API checks the path belongs to this user.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const reply = (status: number, body: { path: string } | { error: string }) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!isSameOrigin(request)) return reply(403, { error: "payouts.errors.uploadFailed" });
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return reply(401, { error: "payouts.errors.sessionEndedApply" });
  const form = await request.formData().catch(() => null);
  const doc = form ? documentFrom(form) : { error: "payouts.input.documentMissing" };
  if ("error" in doc) return reply(400, { error: doc.error });
  try {
    const upload = data(await (await api()).POST("/v1/me/host-application/document-upload-url", { body: { contentType: doc.contentType, sizeBytes: doc.file.size } }));
    const put = await fetch(upload.uploadUrl, { method: "PUT", body: Buffer.from(await doc.file.arrayBuffer()), headers: { "content-type": doc.contentType } }).catch(() => null);
    if (!put?.ok) {
      console.error(`[payouts] document upload to storage failed: ${put?.status ?? "network"}`);
      return reply(502, { error: "payouts.errors.uploadFailed" });
    }
    return reply(200, { path: upload.path });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return reply(401, { error: "payouts.errors.sessionEndedApply" });
    console.error(`[payouts] document upload failed: ${(error as Error).message}`);
    return reply(502, { error: "payouts.errors.uploadFailed" });
  }
}
