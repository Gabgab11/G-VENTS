import type { ComponentPropsWithRef } from "react";
import { cx } from "../cx";
import styles from "./controls.module.css";

export type InputProps = ComponentPropsWithRef<"input">;

/** A text input: 44px tall, 16px text. Put it inside a Field. */
export function Input({ className, type = "text", ...rest }: InputProps) {
  return <input {...rest} type={type} className={cx(styles.control, className)} />;
}
