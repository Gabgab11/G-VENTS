"use client";

import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import type { ComponentPropsWithRef } from "react";
import { cx } from "../cx";
import overlay from "./overlay.module.css";
import styles from "./Menu.module.css";

/** Dropdown menu root (Radix DropdownMenu). */
export const Menu = RadixMenu.Root;

/** Wraps the button that opens the menu (`asChild` by default, so pass a Button). */
export function MenuTrigger({ asChild = true, ...rest }: ComponentPropsWithRef<typeof RadixMenu.Trigger>) {
  return <RadixMenu.Trigger asChild={asChild} {...rest} />;
}

export function MenuContent({ className, sideOffset = 6, align = "end", ...rest }: ComponentPropsWithRef<typeof RadixMenu.Content>) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content {...rest} sideOffset={sideOffset} align={align} className={cx(overlay.floating, styles.content, className)} />
    </RadixMenu.Portal>
  );
}

export type MenuItemProps = ComponentPropsWithRef<typeof RadixMenu.Item> & { danger?: boolean };

/** One action. Use `asChild` with a Next link for navigation items. */
export function MenuItem({ className, danger, ...rest }: MenuItemProps) {
  return <RadixMenu.Item {...rest} className={cx(styles.item, danger && styles.danger, className)} />;
}

export function MenuSeparator({ className, ...rest }: ComponentPropsWithRef<typeof RadixMenu.Separator>) {
  return <RadixMenu.Separator {...rest} className={cx(styles.separator, className)} />;
}

export function MenuLabel({ className, ...rest }: ComponentPropsWithRef<typeof RadixMenu.Label>) {
  return <RadixMenu.Label {...rest} className={cx(styles.label, className)} />;
}
