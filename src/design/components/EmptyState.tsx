import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "../cx";
import styles from "./EmptyState.module.css";

export type EmptyStateProps = Omit<ComponentPropsWithRef<"div">, "title"> & {
  /** A 20px lucide icon. */
  icon?: ReactNode;
  title: ReactNode;
  /** The heading level; h3 by default. */
  headingLevel?: 2 | 3 | 4;
  /** The one next step. */
  action?: ReactNode;
};

/** What an empty list shows: an icon, a heading, one sentence and the next step. */
export function EmptyState({ icon, title, headingLevel = 3, action, className, children, ...rest }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div {...rest} className={cx(styles.empty, className)}>
      {icon ? <span className={styles.mark} aria-hidden>{icon}</span> : null}
      <Heading className={styles.title}>{title}</Heading>
      {children ? <div className={styles.text}>{children}</div> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
