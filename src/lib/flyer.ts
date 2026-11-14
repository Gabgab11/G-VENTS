import "server-only";
import { api, data } from "@/lib/api/server";

// Event flyer (cover image) upload, shared by the create form and the dashboard (U5). The file
// goes to Supabase Storage through a signed URL from the API, which then checks the real file type
// and size before attaching it to the event.

export const FLYER_MAX = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type FlyerType = (typeof TYPES)[number];

export type FlyerProblem = "flyer_missing" | "flyer_type" | "flyer_size" | "flyer_unreadable";

/**
 * A file from a form, recognised by shape rather than `instanceof File`: runtimes differ in which
 * File class a parsed upload is (Node, undici, Cloudflare workerd), and a failed `instanceof`
 * would silently drop the image.
 */
function isUpload(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && typeof (value as Blob).arrayBuffer === "function" && typeof (value as Blob).size === "number";
}

/** The flyer from a form, or why it can't be used. `null` only when no image was chosen. */
export function flyerFrom(formData: FormData): { file: File; contentType: FlyerType } | { problem: FlyerProblem } | null {
  const file = formData.get("flyer");
  if (file === null || file === "") return null;
  if (!isUpload(file)) {
    console.error(`[flyer] the image field held ${typeof file} (${Object.prototype.toString.call(file)}), not a file`);
    return { problem: "flyer_unreadable" };
  }
  if (file.size === 0) return null; // the browser sends an empty file when nothing was chosen
  if (file.size > FLYER_MAX) return { problem: "flyer_size" };
  const contentType = (TYPES as readonly string[]).includes(file.type) ? (file.type as FlyerType) : null;
  if (!contentType) return { problem: "flyer_type" };
  return { file, contentType };
}

/** Uploads and attaches the flyer. API errors are thrown as ApiError; a failed storage upload throws Error. */
export async function uploadFlyer(eventId: string, file: File, contentType: FlyerType): Promise<void> {
  const client = await api();
  const upload = data(await client.POST("/v1/events/{id}/flyer/upload-url", { params: { path: { id: eventId } }, body: { contentType } }));
  const put = await fetch(upload.uploadUrl, { method: "PUT", body: Buffer.from(await file.arrayBuffer()), headers: { "content-type": contentType } }).catch(() => null);
  if (!put?.ok) {
    const reply = put ? (await put.text().catch(() => "")).slice(0, 200) : "";
    throw new Error(`flyer upload to storage failed: ${put?.status ?? "network"} ${reply}`.trim());
  }
  await client.POST("/v1/events/{id}/flyer", { params: { path: { id: eventId } }, body: { path: upload.path } });
}
