// The browser's side of adding an event picture (chunk 3c): the file goes to this site's route
// (/api/events/{id}/images), which uploads it with the API; no secret or storage URL reaches the page.

export type UploadedPicture = { id: string; url: string; width: number | null; height: number | null };
export type PictureUpload = { ok: true; image: UploadedPicture } | { ok: false; code: string };

export async function uploadPicture(eventId: string, file: File, size: { width: number; height: number } | null): Promise<PictureUpload> {
  const body = new FormData();
  body.set("flyer", file);
  if (size) {
    body.set("width", String(size.width));
    body.set("height", String(size.height));
  }
  const res = await fetch(`/api/events/${eventId}/images`, { method: "POST", body, headers: { Accept: "application/json" } }).catch(() => null);
  if (!res) return { ok: false, code: "failed" };
  const reply = (await res.json().catch(() => null)) as PictureUpload | null;
  if (reply && reply.ok && reply.image) return reply;
  return { ok: false, code: reply && !reply.ok && typeof reply.code === "string" ? reply.code : "failed" };
}
