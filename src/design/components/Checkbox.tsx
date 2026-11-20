import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "../cx";
import styles from "./Checkbox.module.css";

export type CheckboxProps = Omit<ComponentPropsWithRef<"input">, "type"> & {
  label: ReactNode;
};

/** A native checkbox with its label; the whole row is a 44px target. */
export function Checkbox({ label, className, ...rest }: CheckboxProps) {
  return (
    <label className={cx(styles.check, className)}>
      <input {...rest} type="checkbox" className={styles.input} />
      <span>{label}</span>
    </label>
  );
}
