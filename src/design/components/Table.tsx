import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "../cx";
import styles from "./Table.module.css";

export type TableProps = ComponentPropsWithRef<"table"> & {
  /** A visible or screen-reader caption naming the table. */
  caption?: ReactNode;
  /** Class for the scrolling wrapper. */
  wrapperClassName?: string;
};

/**
 * A semantic table: write `<thead>`/`<tbody>`/`<tr>` as usual with `Th` and `Td`. Under 640px rows
 * stack as cards, each cell labelled from its `Td label`.
 */
export function Table({ caption, wrapperClassName, className, children, ...rest }: TableProps) {
  return (
    <div className={cx(styles.wrap, wrapperClassName)}>
      <table {...rest} className={cx(styles.table, className)}>
        {caption ? <caption className={styles.caption}>{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export type ThProps = ComponentPropsWithRef<"th"> & { numeric?: boolean };

export function Th({ numeric, scope = "col", className, ...rest }: ThProps) {
  return <th {...rest} scope={scope} className={cx(numeric && styles.numeric, className)} />;
}

export type TdProps = ComponentPropsWithRef<"td"> & {
  /** The column name, shown beside the value when rows stack on phones. */
  label?: string;
  numeric?: boolean;
};

export function Td({ label, numeric, className, ...rest }: TdProps) {
  return <td {...rest} data-label={label} className={cx(numeric && styles.numeric, className)} />;
}
