import NextLink from "next/link";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "../cx";
import styles from "./Tabs.module.css";

export type TabLinksProps = ComponentPropsWithRef<"nav"> & {
  /** The nav's accessible name (translated), e.g. "Event sections". */
  "aria-label": string;
};

/** Route tabs: each tab is its own address, so links and Back work. Looks like `Tabs`. */
export function TabLinks({ className, children, ...rest }: TabLinksProps) {
  return (
    <nav {...rest} className={cx(styles.list, className)}>
      {children}
    </nav>
  );
}

export type TabLinkProps = Omit<ComponentPropsWithRef<"a">, "href"> & {
  href: string;
  /** This tab is the current page (sets aria-current="page"). */
  active?: boolean;
  count?: ReactNode;
};

export function TabLink({ href, active = false, count, className, children, ...rest }: TabLinkProps) {
  return (
    <NextLink {...rest} href={href} aria-current={active ? "page" : undefined} className={cx(styles.tab, className)}>
      {children}
      {count !== undefined ? <span className={styles.count}>{count}</span> : null}
    </NextLink>
  );
}
