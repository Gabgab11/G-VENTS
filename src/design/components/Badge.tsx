import { BadgeCheck } from "lucide-react";
import type { ComponentPropsWithRef } from "react";
import { cx } from "../cx";
import styles from "./Badge.module.css";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

export type BadgeProps = ComponentPropsWithRef<"span"> & {
  tone?: BadgeTone;
  /** No status dot (prices on event cards). */
  plain?: boolean;
  /** The verified-host mark: a check icon on the accent-soft ground. */
  verified?: boolean;
};

/** Small pill label: a dot and a word, never colour alone. */
export function Badge({ tone = "neutral", plain = false, verified = false, className, children, ...rest }: BadgeProps) {
  return (
    <span {...rest} className={cx(styles.badge, styles[tone], (plain || verified) && styles.plain, verified && styles.verified, className)}>
      {verified ? <BadgeCheck size={16} strokeWidth={1.75} aria-hidden /> : null}
      {children}
    </span>
  );
}
