// The event page gallery's arithmetic (chunk 3c), kept apart from the component so it can be tested.

/** At most this many thumbnails under the main picture; the last one shows "+N" when there are more. */
export const MAX_THUMBS = 4;

/** `index` moved by `delta`, wrapping round both ends. */
export function wrap(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (((index + delta) % count) + count) % count;
}

export type Thumb = {
  /** The picture this thumbnail shows and opens. */
  index: number;
  /** Pictures held behind this thumbnail ("+N"), 0 for an ordinary one. */
  more: number;
  /** Outlined: it shows the active picture (the "+N" one also stands for every picture after it). */
  active: boolean;
};

/**
 * The thumbnail strip: every picture when they fit, otherwise the first MAX_THUMBS - 1 and a last
 * one standing for the rest, labelled "+N" with N the pictures it holds. No strip for one picture.
 */
export function thumbStrip(count: number, active: number, max = MAX_THUMBS): Thumb[] {
  if (count <= 1) return [];
  if (count <= max) return Array.from({ length: count }, (_, i) => ({ index: i, more: 0, active: i === active }));
  const shown = max - 1;
  const thumbs: Thumb[] = Array.from({ length: shown }, (_, i) => ({ index: i, more: 0, active: i === active }));
  thumbs.push({ index: shown, more: count - shown, active: active >= shown });
  return thumbs;
}

/** The main picture's frame (width / height) from its reported size, kept between portrait and landscape. */
export function frameRatio(width: number | null | undefined, height: number | null | undefined): number {
  if (!width || !height || width <= 0 || height <= 0) return 1;
  return Math.min(1.5, Math.max(0.75, width / height));
}

/** A horizontal swipe far enough to change picture: -1 (towards the start), 1 (towards the end) or 0. */
export function swipeStep(dx: number, dy: number, rtl: boolean, threshold = 40): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return 0;
  const forward = rtl ? dx > 0 : dx < 0;
  return forward ? 1 : -1;
}
