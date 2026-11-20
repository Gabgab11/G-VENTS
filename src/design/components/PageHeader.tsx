import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "../cx";
import styles from "./PageHeader.module.css";

export type PageHeaderProps = Omit<ComponentPropsWithRef<"header">, "title"> & {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Buttons at the inline end; they wrap under the title on narrow screens. */
  actions?: ReactNode;
};

/** The page's h1 in the display face, an optional subtitle and actions. */
export function PageHeader({ title, subtitle, actions, className, ...rest }: PageHeaderProps) {
  return (
    <header {...rest} className={cx(styles.header, className)}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
