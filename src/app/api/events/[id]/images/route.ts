import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api/problem";
import { reportedSize, uploadEventImage } from "@/lib/event-images";
import { flyerFrom } from "@/lib/flyer";
import { isUuid } from "@/lib/forms";
import { isSameOrigin } from "@/lib/same-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Adds one picture to an event (chunk 3c), outside Server Actions like the flyer route (see
// src/lib/same-origin.ts for why). The browser posts the file as `flyer`, with the `width` and
// `height` it measured; the answer is JSON: { ok: true, image } or { ok: false, code }, where `code`
// is an API error code (event.images_full, flyer.size, ...) or one of the flyer problems. The API
// decides who may add pictures (event.edit), checks the real file type and refuses a sixth.
export const dynamic = "force-dynamic";

const reply = (body: object, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return reply({ ok: false, code: "event.not_found" }, 404);
  if (!isSameOrigin(request)) return reply({ ok: false, code: "failed" }, 403);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return reply({ ok: false, code: "signed_out" }, 401);
  const form = await request.formData().catch(() => null);
  if (!form) return reply({ ok: false, code: "flyer_unreadable" }, 400);
  const picture = flyerFrom(form);
  if (!picture) return reply({ ok: false, code: "flyer_missing" }, 400);
  if ("problem" in picture) return reply({ ok: false, code: picture.problem }, 400);
  try {
    const image = await uploadEventImage(id, picture.file, picture.contentType, { width: reportedSize(form.get("width")), height: reportedSize(form.get("height")) });
    console.info(`[pictures] picture added to ${id} (${picture.contentType}, ${picture.file.size} bytes)`);
    revalidatePath(`/host/events/${id}`);
    revalidatePath("/host/events");
    return reply({ ok: true, image }, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status >= 500) console.error(`[pictures] ${error.message}`);
      // 5xx codes are passed on only when the API chose to explain them (storage unavailable, busy).
      const shown = error.status < 500 || (error.status === 503 && error.code !== "internal_error");
      return reply({ ok: false, code: shown ? error.code : "failed" }, error.status);
    }
    console.error(`[pictures] ${(error as Error).message}`);
    return reply({ ok: false, code: "failed" }, 502);
  }
}
