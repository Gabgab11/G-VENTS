import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithRef } from "react";
import { cx } from "../cx";
import styles from "./controls.module.css";

export type SelectProps = ComponentPropsWithRef<"select">;

/** A native select with the system chevron replaced. Pass `<option>`s as children. */
export function Select({ className, ...rest }: SelectProps) {
  return (
    <span className={styles.selectWrap}>
      <select {...rest} className={cx(styles.control, styles.select, className)} />
      <ChevronDown className={styles.chevron} size={20} strokeWidth={1.75} aria-hidden />
    </span>
  );
}
