import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "../cx";
import styles from "./Banner.module.css";

export type BannerTone = "info" | "success" | "warning" | "danger";

export type BannerProps = Omit<ComponentPropsWithRef<"div">, "title"> & {
  tone?: BannerTone;
  title: ReactNode;
  /** One optional action: a link or a small button. */
  action?: ReactNode;
};

const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert } as const;

/** A full-width message with an icon, a title, one sentence and at most one action. */
export function Banner({ tone = "info", title, action, className, children, ...rest }: BannerProps) {
  const Icon = ICONS[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} {...rest} className={cx(styles.banner, styles[tone], className)}>
      <Icon className={styles.icon} size={20} strokeWidth={1.75} aria-hidden />
      <div className={styles.body}>
        <strong className={styles.title}>{title}</strong>
        {children ? <div className={styles.text}>{children}</div> : null}
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
