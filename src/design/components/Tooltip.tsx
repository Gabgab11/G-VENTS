"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ComponentPropsWithRef, ReactElement, ReactNode } from "react";
import { cx } from "../cx";
import styles from "./Tooltip.module.css";

export type TooltipProps = Omit<ComponentPropsWithRef<typeof RadixTooltip.Content>, "content" | "children"> & {
  content: ReactNode;
  /** One focusable element (a Button), used as the trigger. */
  children: ReactElement;
  delayDuration?: number;
};

/** `<Tooltip content="Copy link"><Button …/></Tooltip>`; brings its own provider. */
export function Tooltip({ content, children, delayDuration = 300, className, sideOffset = 6, ...rest }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content {...rest} sideOffset={sideOffset} className={cx(styles.tooltip, className)}>
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
