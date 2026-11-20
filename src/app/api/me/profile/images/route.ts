import { revalidatePath } from "next/cache";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import { flyerFrom } from "@/lib/flyer";
import { isSameOrigin } from "@/lib/same-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// A host's avatar or cover (Change 4 chunk 4, FR-32), the same way as event pictures
// (../../../events/[id]/images/route.ts): a route handler rather than a Server Action (see
// src/lib/same-origin.ts), the bytes PUT to storage from the server through the API's signed URL, then
// PATCH /v1/me/profile with the path, where the API checks the real type and size. The browser posts
// `kind` (avatar | cover) and the file as `flyer`; the answer is { ok: true, url } or { ok: false, code }.
export const dynamic = "force-dynamic";

const reply = (body: object, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return reply({ ok: false, code: "failed" }, 403);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return reply({ ok: false, code: "signed_out" }, 401);
  const form = await request.formData().catch(() => null);
  if (!form) return reply({ ok: false, code: "flyer_unreadable" }, 400);
  const kind = form.get("kind");
  if (kind !== "avatar" && kind !== "cover") return reply({ ok: false, code: "failed" }, 400);
  const picture = flyerFrom(form);
  if (!picture) return reply({ ok: false, code: "flyer_missing" }, 400);
  if ("problem" in picture) return reply({ ok: false, code: picture.problem }, 400);
  try {
    const client = await api();
    const upload = data(await client.POST("/v1/me/profile/images/upload-url", { body: { kind, contentType: picture.contentType } }));
    const put = await fetch(upload.uploadUrl, { method: "PUT", body: Buffer.from(await picture.file.arrayBuffer()), headers: { "content-type": picture.contentType } }).catch(() => null);
    if (!put?.ok) {
      console.error(`[profile] ${kind} upload to storage failed: ${put?.status ?? "network"}`);
      return reply({ ok: false, code: "failed" }, 502);
    }
    const profile = data(await client.PATCH("/v1/me/profile", { body: kind === "avatar" ? { avatarPath: upload.path } : { coverPath: upload.path } }));
    console.info(`[profile] ${kind} saved (${picture.contentType}, ${picture.file.size} bytes)`);
    revalidatePath("/host/settings/profile");
    return reply({ ok: true, url: kind === "avatar" ? profile.avatarUrl : profile.coverUrl }, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return reply({ ok: false, code: "signed_out" }, 401);
      if (error.status >= 500) console.error(`[profile] ${error.message}`);
      const shown = error.status < 500 || (error.status === 503 && error.code !== "internal_error");
      return reply({ ok: false, code: shown ? error.code : "failed" }, error.status);
    }
    console.error(`[profile] ${(error as Error).message}`);
    return reply({ ok: false, code: "failed" }, 502);
  }
}
