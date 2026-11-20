"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { api, data } from "@/lib/api/server";
import { ApiError, problemMessage } from "@/lib/api/problem";
import { isUuid } from "@/lib/forms";
import { MAX_PICTURES } from "@/lib/picture-list";
import type { UploadedPicture } from "@/lib/picture-upload";

// The Details tab's picture manager (chunk 3c): reorder and remove, each saved at once. Adding goes
// through /api/events/{id}/images (a file, so not a Server Action). The API checks the caller may
// edit the event and that the order names exactly the event's pictures.

export type PicturesResult = { ok: true; images: UploadedPicture[] } | { ok: true; removed: true } | { ok: false; error: string };

async function failure(error: unknown): Promise<PicturesResult> {
  if (!(error instanceof ApiError) || error.status >= 500) console.error("[pictures]", error instanceof Error ? error.message : error);
  const t = await getTranslations("createEvent.pictures");
  return { ok: false, error: problemMessage(error, await getTranslations("errors"), await getLocale(), t("failed")) };
}

function refresh(id: string) {
  revalidatePath(`/host/events/${id}`);
  revalidatePath("/host/events");
}

/** Saves the pictures' order; the first becomes the main picture. Answers the order the API kept. */
export async function reorderPictures(eventId: string, ids: string[]): Promise<PicturesResult> {
  if (!isUuid(eventId) || !Array.isArray(ids) || ids.length === 0 || ids.length > MAX_PICTURES || !ids.every((x) => typeof x === "string" && isUuid(x))) {
    return failure(null);
  }
  try {
    const images = data(await (await api()).PUT("/v1/events/{id}/images/order", { params: { path: { id: eventId } }, body: { ids } }));
    refresh(eventId);
    return { ok: true, images };
  } catch (error) {
    return failure(error);
  }
}

/** Removes one picture; the ones after it move up. */
export async function removePicture(eventId: string, imageId: string): Promise<PicturesResult> {
  if (!isUuid(eventId) || !isUuid(imageId)) return failure(null);
  try {
    await (await api()).DELETE("/v1/events/{id}/images/{imageId}", { params: { path: { id: eventId, imageId } } });
    refresh(eventId);
    return { ok: true, removed: true };
  } catch (error) {
    return failure(error);
  }
}
