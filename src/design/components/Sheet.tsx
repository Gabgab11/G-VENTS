"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { DialogClose, DialogTrigger, OverlayContent, type DialogContentProps } from "./Dialog";

/** A bottom sheet under 640px and a centred dialog above; same API as Dialog. */
export const Sheet = RadixDialog.Root;
export const SheetTrigger = DialogTrigger;
export const SheetClose = DialogClose;
export type SheetContentProps = DialogContentProps;

export function SheetContent(props: SheetContentProps) {
  return <OverlayContent {...props} variant="sheet" />;
}
