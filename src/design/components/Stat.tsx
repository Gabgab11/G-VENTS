import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "../cx";
import styles from "./Stat.module.css";

export type StatTrend = "up" | "down" | "flat";

export type StatProps = ComponentPropsWithRef<"div"> & {
  label: ReactNode;
  /** The formatted value (money already formatted from minor units in the event's currency). */
  value: ReactNode;
  /** A comparison: an arrow plus the caller's words, e.g. { trend: "up", text: "18% vs previous 30 days" }. */
  delta?: { trend: StatTrend; text: ReactNode };
  /** A context line used when there is no previous period ("First 30 days"). */
  context?: ReactNode;
};

const ARROWS = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

/** One headline number with its label and comparison. Never colour alone: arrow + words. */
export function Stat({ label, value, delta, context, className, ...rest }: StatProps) {
  const Arrow = delta ? ARROWS[delta.trend] : null;
  return (
    <div {...rest} className={cx(styles.stat, className)}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
      {delta && Arrow ? (
        <div className={cx(styles.delta, styles[delta.trend])} data-trend={delta.trend}>
          <Arrow className={styles.arrow} size={16} strokeWidth={1.75} aria-hidden />
          <span>{delta.text}</span>
        </div>
      ) : context ? (
        <div className={styles.delta}>{context}</div>
      ) : null}
    </div>
  );
}
