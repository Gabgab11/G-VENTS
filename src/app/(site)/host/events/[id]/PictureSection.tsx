"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PictureManager, { measurePicture, usePictureError, type ManagedPicture } from "@/components/PictureManager";
import { movePicture, orderIds, roomFor } from "@/lib/picture-list";
import { uploadPicture, type UploadedPicture } from "@/lib/picture-upload";
import { removePicture, reorderPictures } from "./picture-actions";

type Item = ManagedPicture & { id?: string };

const fromImage = (p: UploadedPicture): Item => ({ key: p.id, id: p.id, url: p.url });
let nextKey = 1;

// The Details tab's pictures (chunk 3c): every change is saved at once. New pictures upload one
// after the other (in the order chosen) and appear as they finish; a move or a removal shows
// straight away and goes back if the API refuses it.
export default function PictureSection({ eventId, images }: { eventId: string; images: UploadedPicture[] }) {
  const router = useRouter();
  const message = usePictureError();
  const [items, setItems] = useState<Item[]>(() => images.map(fromImage));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(items);
  latest.current = items;

  async function add(files: File[]) {
    setError("");
    setBusy(true);
    const pending: Item[] = files.slice(0, roomFor(latest.current.length)).map((file) => ({ key: `new-${nextKey++}`, url: URL.createObjectURL(file), uploading: true }));
    setItems((list) => [...list, ...pending]);
    for (const [i, item] of pending.entries()) {
      const size = await measurePicture(item.url);
      const result = await uploadPicture(eventId, files[i]!, size);
      URL.revokeObjectURL(item.url);
      if (result.ok) {
        setItems((list) => list.map((x) => (x.key === item.key ? fromImage(result.image) : x)));
      } else {
        // Stop at the first refusal (a full gallery refuses the rest too) and drop what's left.
        const left = new Set(pending.slice(i).map((x) => x.key));
        pending.slice(i + 1).forEach((x) => URL.revokeObjectURL(x.url));
        setItems((list) => list.filter((x) => !left.has(x.key)));
        setError(message(result.code));
        break;
      }
    }
    setBusy(false);
    router.refresh();
  }

  async function move(from: number, to: number) {
    const before = latest.current;
    const after = movePicture(before, from, to);
    setError("");
    setItems(after);
    setBusy(true);
    const result = await reorderPictures(eventId, orderIds(after));
    setBusy(false);
    if (!result.ok) { setItems(before); setError(result.error); return; }
    if ("images" in result) setItems(result.images.map(fromImage));
    router.refresh();
  }

  async function remove(index: number) {
    const before = latest.current;
    const target = before[index];
    if (!target?.id) return;
    setError("");
    setItems(before.filter((_, i) => i !== index));
    setBusy(true);
    const result = await removePicture(eventId, target.id);
    setBusy(false);
    if (!result.ok) { setItems(before); setError(result.error); return; }
    router.refresh();
  }

  return <PictureManager pictures={items} onAdd={add} onMove={move} onRemove={remove} busy={busy} error={error} hideLabel />;
}
