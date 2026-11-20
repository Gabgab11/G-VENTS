"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "../cx";
import styles from "./Dialog.module.css";

/** Dialog root (Radix Dialog): `open`/`defaultOpen`/`onOpenChange`. */
export const Dialog = RadixDialog.Root;

/** Wraps the control that opens the dialog (`asChild` by default, so pass a Button). */
export function DialogTrigger({ asChild = true, ...rest }: ComponentPropsWithRef<typeof RadixDialog.Trigger>) {
  return <RadixDialog.Trigger asChild={asChild} {...rest} />;
}

/** Closes the dialog (`asChild` by default, so pass a Button). */
export function DialogClose({ asChild = true, ...rest }: ComponentPropsWithRef<typeof RadixDialog.Close>) {
  return <RadixDialog.Close asChild={asChild} {...rest} />;
}

export type DialogContentProps = Omit<ComponentPropsWithRef<typeof RadixDialog.Content>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  /** Accessible name of the close button (translated by the caller). */
  closeLabel?: string;
  /** Buttons at the bottom, e.g. Cancel and Confirm. */
  footer?: ReactNode;
};

type Variant = { variant: "dialog" | "sheet" };

/** Shared by Dialog and Sheet. */
export function OverlayContent({ title, description, closeLabel = "Close", footer, className, children, variant, ...rest }: DialogContentProps & Variant) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className={cx(styles.overlay, variant === "sheet" && styles.sheetOverlay)}>
        <RadixDialog.Content
          {...rest}
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cx(styles.content, variant === "sheet" && styles.sheet, className)}
        >
          {variant === "sheet" ? <span className={styles.grabber} aria-hidden /> : null}
          <div className={styles.header}>
            <div className={styles.headings}>
              <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
              {description ? <RadixDialog.Description className={styles.description}>{description}</RadixDialog.Description> : null}
            </div>
            <RadixDialog.Close className={styles.close} aria-label={closeLabel}>
              <X size={20} strokeWidth={1.75} aria-hidden />
            </RadixDialog.Close>
          </div>
          {children ? <div className={styles.body}>{children}</div> : null}
          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Overlay>
    </RadixDialog.Portal>
  );
}

/** The dialog panel: title, optional description, a close button, body and optional footer. */
export function DialogContent(props: DialogContentProps) {
  return <OverlayContent {...props} variant="dialog" />;
}
