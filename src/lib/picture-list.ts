// An event's pictures as the host arranges them (chunk 3c): up to five, the first is the main one.
// Pure list logic shared by the create stepper and the Details tab, so it can be tested.

export const MAX_PICTURES = 5;
export const PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** The same limit as flyers (src/lib/flyer.ts); the API checks it again. */
export const PICTURE_MAX_BYTES = 5 * 1024 * 1024;

export type PictureProblem = "type" | "size" | "full";

/** The list with the item at `from` moved to `to` (both clamped); the same list when nothing moves. */
export function movePicture<T>(list: readonly T[], from: number, to: number): T[] {
  const last = list.length - 1;
  if (from < 0 || from > last) return [...list];
  const target = Math.min(Math.max(to, 0), last);
  if (target === from) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item!);
  return next;
}

/** The list with the item at `index` first: the main picture. */
export function makeMain<T>(list: readonly T[], index: number): T[] {
  return movePicture(list, index, 0);
}

/** How many more pictures fit. */
export function roomFor(count: number, max = MAX_PICTURES): number {
  return Math.max(0, max - count);
}

type FileLike = { name: string; type: string; size: number };

/**
 * Splits chosen files into those to add (in the order chosen) and those refused, with why: a type
 * other than JPEG, PNG or WebP, over 5 MB, or no room left once `existing` and the accepted ones count.
 */
export function pickPictures<F extends FileLike>(files: readonly F[], existing: number, max = MAX_PICTURES): { accepted: F[]; refused: { file: F; problem: PictureProblem }[] } {
  const accepted: F[] = [];
  const refused: { file: F; problem: PictureProblem }[] = [];
  for (const file of files) {
    if (!(PICTURE_TYPES as readonly string[]).includes(file.type)) refused.push({ file, problem: "type" });
    else if (file.size > PICTURE_MAX_BYTES) refused.push({ file, problem: "size" });
    else if (existing + accepted.length >= max) refused.push({ file, problem: "full" });
    else accepted.push(file);
  }
  return { accepted, refused };
}

/** The ids in their new order, for PUT /v1/events/{id}/images/order. */
export function orderIds(list: readonly { id?: string | null }[]): string[] {
  return list.map((p) => p.id).filter((id): id is string => typeof id === "string" && id.length > 0);
}
