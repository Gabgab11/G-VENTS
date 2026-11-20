"use client";

import * as RadixPopover from "@radix-ui/react-popover";
import type { ComponentPropsWithRef } from "react";
import { cx } from "../cx";
import overlay from "./overlay.module.css";
import styles from "./Popover.module.css";

/** Popover root (Radix Popover): `open`/`defaultOpen`/`onOpenChange`. */
export const Popover = RadixPopover.Root;

/** Wraps the control that opens the popover (`asChild` by default, so pass a Button). */
export function PopoverTrigger({ asChild = true, ...rest }: ComponentPropsWithRef<typeof RadixPopover.Trigger>) {
  return <RadixPopover.Trigger asChild={asChild} {...rest} />;
}

export function PopoverClose({ asChild = true, ...rest }: ComponentPropsWithRef<typeof RadixPopover.Close>) {
  return <RadixPopover.Close asChild={asChild} {...rest} />;
}

export function PopoverContent({ className, sideOffset = 6, ...rest }: ComponentPropsWithRef<typeof RadixPopover.Content>) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content {...rest} sideOffset={sideOffset} className={cx(overlay.floating, styles.popover, className)} />
    </RadixPopover.Portal>
  );
}
