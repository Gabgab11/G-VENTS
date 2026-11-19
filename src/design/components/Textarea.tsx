import type { ComponentPropsWithRef } from "react";
import { cx } from "../cx";
import styles from "./controls.module.css";

export type TextareaProps = ComponentPropsWithRef<"textarea">;

/** A multi-line text input that resizes vertically. Put it inside a Field. */
export function Textarea({ className, rows = 4, ...rest }: TextareaProps) {
  return <textarea {...rest} rows={rows} className={cx(styles.control, styles.textarea, className)} />;
}
