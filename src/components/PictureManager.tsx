"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, Star, Trash2 } from "lucide-react";
import { Badge, Button, cx } from "@/design";
import { MAX_PICTURES, PICTURE_TYPES, pickPictures, roomFor } from "@/lib/picture-list";
import s from "./PictureManager.module.css";

export type ManagedPicture = { key: string; url: string; uploading?: boolean };

/** A picture's size in pixels, read in the browser (the API stores what the uploader reports). */
export function measurePicture(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Words for a failed picture change: an API error code (from the errors area) or one of the upload route's own codes. */
export function usePictureError() {
  const t = useTranslations("createEvent.pictures");
  const errors = useTranslations("errors");
  return (code: string) => {
    if (code.includes(".") && errors.has(code)) return errors(code);
    if (code === "flyer_type") return t("wrongTypePlain");
    if (code === "flyer_size") return t("tooLargePlain");
    if (code === "signed_out") return t("signedOut");
    return t("failed");
  };
}

// The host's picture picker (chunk 3c), used by the create stepper (local files, sent once the event
// exists) and the Details tab (saved as they change). Up to five; the first is the main picture.
// Reorder by dragging or with the buttons on each picture; "Make main" moves one to the front.
// The parent owns the list and does the saving; this checks the files and draws the controls.
export default function PictureManager({
  pictures,
  onAdd,
  onMove,
  onRemove,
  busy = false,
  error,
  hideLabel = false,
}: {
  pictures: ManagedPicture[];
  onAdd: (files: File[]) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  busy?: boolean;
  /** A problem from saving, shown with the picker's own. */
  error?: string;
  /** The label is said by a heading around it (the Details tab's card): keep it for screen readers only. */
  hideLabel?: boolean;
}) {
  const t = useTranslations("createEvent.pictures");
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [problem, setProblem] = useState("");
  const [announce, setAnnounce] = useState("");
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  // After a move, focus follows the picture to the same button in its new place.
  const refocus = useRef<{ key: string; action: string } | null>(null);
  const room = roomFor(pictures.length);

  // While a change saves the buttons are disabled, so this waits until they're back.
  useEffect(() => {
    const target = refocus.current;
    if (!target || !list.current || busy) return;
    refocus.current = null;
    const item = list.current.querySelector<HTMLElement>(`[data-key="${CSS.escape(target.key)}"]`);
    const button = item?.querySelector<HTMLButtonElement>(`[data-action="${target.action}"]:not(:disabled)`)
      ?? item?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    button?.focus();
  }, [pictures, busy]);

  function choose(files: FileList | null) {
    if (!files || files.length === 0) return;
    const { accepted, refused } = pickPictures(Array.from(files), pictures.length);
    const first = refused[0];
    setProblem(!first ? "" : first.problem === "full" ? t("full", { max: MAX_PICTURES }) : first.problem === "type" ? t("wrongType", { name: first.file.name }) : t("tooLarge", { name: first.file.name }));
    if (input.current) input.current.value = "";
    if (accepted.length) onAdd(accepted);
  }

  function move(from: number, to: number, action: string) {
    const p = pictures[from];
    if (!p || busy) return;
    refocus.current = { key: p.key, action };
    onMove(from, to);
    const at = Math.min(Math.max(to, 0), pictures.length - 1);
    setAnnounce(at === 0 ? t("madeMain") : t("moved", { number: at + 1, total: pictures.length }));
  }

  function remove(index: number) {
    if (busy) return;
    const next = pictures[index + 1] ?? pictures[index - 1];
    if (next) refocus.current = { key: next.key, action: "remove" };
    onRemove(index);
    setAnnounce(t("removed"));
  }

  const drag = {
    start: (i: number) => (e: DragEvent<HTMLLIElement>) => {
      if (busy) { e.preventDefault(); return; }
      setDragFrom(i);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(i));
    },
    over: (i: number) => (e: DragEvent<HTMLLIElement>) => {
      if (dragFrom === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOver !== i) setDragOver(i);
    },
    drop: (i: number) => (e: DragEvent<HTMLLIElement>) => {
      e.preventDefault();
      const from = dragFrom;
      setDragFrom(null);
      setDragOver(null);
      if (from !== null && from !== i) move(from, i, "drag");
    },
    end: () => { setDragFrom(null); setDragOver(null); },
  };

  const shown = error || problem;

  return (
    <div className={s.manager} role="group" aria-labelledby={`${id}-label`} aria-describedby={`${id}-help`}>
      <div className={s.head}>
        <span className={hideLabel ? "sr-only" : s.label} id={`${id}-label`}>{t("label")}</span>
        <span className={s.count}>{t("count", { count: pictures.length, max: MAX_PICTURES })}</span>
      </div>
      <p className={s.hint} id={`${id}-help`}>{t("help", { max: MAX_PICTURES })}</p>

      <ul ref={list} className={s.grid}>
        {pictures.map((p, i) => (
          <li
            key={p.key}
            data-key={p.key}
            className={cx(s.item, dragFrom === i && s.dragging, dragOver === i && dragFrom !== i && s.dropTarget)}
            draggable={!busy && !p.uploading && pictures.length > 1}
            onDragStart={drag.start(i)}
            onDragOver={drag.over(i)}
            onDrop={drag.drop(i)}
            onDragEnd={drag.end}
          >
            <div className={s.thumb}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a preview: a local file or a stored picture */}
              <img src={p.url} alt={t("alt", { number: i + 1 })} draggable={false} />
              {i === 0 && <span className={s.main}><Badge tone="accent">{t("main")}</Badge></span>}
              {p.uploading && (
                <span className={s.uploading}>
                  <LoaderCircle className={s.spin} size={20} strokeWidth={1.75} aria-hidden />
                  <span>{t("uploading")}</span>
                </span>
              )}
            </div>
            <div className={s.actions}>
              <Button size="sm" variant="ghost" icon={<ArrowLeft className={s.flip} size={16} strokeWidth={1.75} aria-hidden />} data-action="earlier"
                aria-label={t("earlier", { number: i + 1 })} disabled={busy || p.uploading || i === 0} onClick={() => move(i, i - 1, "earlier")} />
              <Button size="sm" variant="ghost" icon={<ArrowRight className={s.flip} size={16} strokeWidth={1.75} aria-hidden />} data-action="later"
                aria-label={t("later", { number: i + 1 })} disabled={busy || p.uploading || i === pictures.length - 1} onClick={() => move(i, i + 1, "later")} />
              {i > 0 && (
                <Button size="sm" variant="ghost" icon={<Star size={16} strokeWidth={1.75} aria-hidden />} data-action="main"
                  aria-label={t("makeMain", { number: i + 1 })} title={t("makeMainShort")} disabled={busy || p.uploading} onClick={() => move(i, 0, "main")} />
              )}
              <Button size="sm" variant="ghost" icon={<Trash2 size={16} strokeWidth={1.75} aria-hidden />} data-action="remove"
                aria-label={t("remove", { number: i + 1 })} disabled={busy || p.uploading} onClick={() => remove(i)} />
            </div>
          </li>
        ))}
        {room > 0 && (
          <li className={s.addItem}>
            <button type="button" className={s.add} onClick={() => input.current?.click()} disabled={busy}>
              <ImagePlus size={20} strokeWidth={1.75} aria-hidden />
              <span>{pictures.length ? t("addMore") : t("add")}</span>
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" multiple accept={PICTURE_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => choose(e.target.files)} />

      {room === 0 && shown !== t("full", { max: MAX_PICTURES }) && <p className={s.hint}>{t("full", { max: MAX_PICTURES })}</p>}
      {pictures.length === 0 && <p className={s.hint}>{t("none")}</p>}
      {shown && <p className={s.error} role="alert">{shown}</p>}
      <p className="sr-only" aria-live="polite">{announce}</p>
    </div>
  );
}
