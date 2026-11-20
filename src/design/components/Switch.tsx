"use client";

import { useState, type ComponentPropsWithRef, type MouseEvent } from "react";
import { cx } from "../cx";
import styles from "./Switch.module.css";

export type SwitchProps = Omit<ComponentPropsWithRef<"button">, "type" | "role" | "value" | "defaultValue" | "onChange"> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** With a name, a hidden input submits "on" when checked (like a checkbox). */
  name?: string;
  value?: string;
  required?: boolean;
};

/** An on/off switch (role="switch"); controlled with `checked`, or uncontrolled with `defaultChecked`. */
export function Switch({ checked, defaultChecked = false, onCheckedChange, onClick, name, value = "on", required, className, disabled, ...rest }: SwitchProps) {
  const [own, setOwn] = useState(defaultChecked);
  const isOn = checked ?? own;

  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (checked === undefined) setOwn(!isOn);
    onCheckedChange?.(!isOn);
  };

  return (
    <>
      <button
        {...rest}
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={toggle}
        className={cx(styles.switch, className)}
      >
        <span className={styles.thumb} aria-hidden />
      </button>
      {name && isOn ? <input type="hidden" name={name} value={value} /> : null}
    </>
  );
}
