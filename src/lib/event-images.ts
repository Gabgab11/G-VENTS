import "server-only";
import { api, data } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";
import type { FlyerType } from "@/lib/flyer";

export type EventImage = components["schemas"]["EventImageResponse"];

/** A pixel size the browser reported, kept only when it is a sensible whole number. */
export function reportedSize(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || !/^\d{1,5}$/.test(value)) return undefined;
  const n = Number(value);
  return n > 0 && n <= 20000 ? n : undefined;
}

// One more event picture (chunk 3c), the same way as the flyer (src/lib/flyer.ts): an upload URL from
// the API, the bytes PUT to storage from the server, then the API checks the real type and size and
// adds it after the others. API errors are thrown as ApiError; a failed storage upload throws Error.
export async function uploadEventImage(
  eventId: string,
  file: File,
  contentType: FlyerType,
  size: { width?: number; height?: number },
): Promise<EventImage> {
  const client = await api();
  const upload = data(await client.POST("/v1/events/{id}/images/upload-url", { params: { path: { id: eventId } }, body: { contentType, size: file.size } }));
  const put = await fetch(upload.uploadUrl, { method: "PUT", body: Buffer.from(await file.arrayBuffer()), headers: { "content-type": contentType } }).catch(() => null);
  if (!put?.ok) {
    const reply = put ? (await put.text().catch(() => "")).slice(0, 200) : "";
    throw new Error(`picture upload to storage failed: ${put?.status ?? "network"} ${reply}`.trim());
  }
  return data(await client.POST("/v1/events/{id}/images", {
    params: { path: { id: eventId } },
    body: { path: upload.path, ...(size.width && size.height ? { width: size.width, height: size.height } : {}) },
  }));
}
