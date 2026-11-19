import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "../cx";
import styles from "./Card.module.css";

export type CardProps = ComponentPropsWithRef<"div"> & { as?: "div" | "section" | "article" };

/** A bordered surface for one topic. Don't nest cards. */
export function Card({ as: Tag = "div", className, ...rest }: CardProps) {
  return <Tag {...rest} className={cx(styles.card, className)} />;
}

export type CardHeaderProps = Omit<ComponentPropsWithRef<"div">, "title"> & {
  title: ReactNode;
  /** The heading level; h2 by default. */
  headingLevel?: 2 | 3 | 4;
  /** One optional action: a link or a small secondary button. */
  action?: ReactNode;
};

/** The card's title row with an optional action at the inline end. */
export function CardHeader({ title, headingLevel = 2, action, className, ...rest }: CardHeaderProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div {...rest} className={cx(styles.header, className)}>
      <Heading className={styles.title}>{title}</Heading>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
