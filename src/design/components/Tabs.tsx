"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "../cx";
import styles from "./Tabs.module.css";

/** Radix Tabs root: `value`/`defaultValue`/`onValueChange`. */
export function Tabs({ className, ...rest }: ComponentPropsWithRef<typeof RadixTabs.Root>) {
  return <RadixTabs.Root {...rest} className={cx(styles.root, className)} />;
}

export function TabsList({ className, ...rest }: ComponentPropsWithRef<typeof RadixTabs.List>) {
  return <RadixTabs.List {...rest} className={cx(styles.list, className)} />;
}

export type TabsTriggerProps = ComponentPropsWithRef<typeof RadixTabs.Trigger> & { count?: ReactNode };

export function TabsTrigger({ className, count, children, ...rest }: TabsTriggerProps) {
  return (
    <RadixTabs.Trigger {...rest} className={cx(styles.tab, className)}>
      {children}
      {count !== undefined ? <span className={styles.count}>{count}</span> : null}
    </RadixTabs.Trigger>
  );
}

export function TabsContent({ className, ...rest }: ComponentPropsWithRef<typeof RadixTabs.Content>) {
  return <RadixTabs.Content {...rest} className={cx(styles.content, className)} />;
}
