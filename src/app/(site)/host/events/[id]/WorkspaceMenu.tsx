"use client";

import NextLink from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/design";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/design/client";

type Labels = { more: string; edit: string; cancel: string; remove: string };

// The workspace header's ⋯ menu: edit details, and the danger actions, which open their confirm
// forms in Settings (cancel and delete each need an explicit confirmation there).
export default function WorkspaceMenu({ id, edit, cancel, remove, labels }: { id: string; edit: boolean; cancel: boolean; remove: boolean; labels: Labels }) {
  if (!edit && !cancel && !remove) return null;
  return (
    <Menu>
      <MenuTrigger>
        <Button size="sm" variant="ghost" icon={<MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />} aria-label={labels.more} />
      </MenuTrigger>
      <MenuContent>
        {edit && <MenuItem asChild><NextLink href={`/host/events/${id}?tab=details`}>{labels.edit}</NextLink></MenuItem>}
        {edit && (cancel || remove) && <MenuSeparator />}
        {cancel && <MenuItem asChild danger><NextLink href={`/host/events/${id}?tab=settings#cancel`}>{labels.cancel}</NextLink></MenuItem>}
        {remove && <MenuItem asChild danger><NextLink href={`/host/events/${id}?tab=settings#delete`}>{labels.remove}</NextLink></MenuItem>}
      </MenuContent>
    </Menu>
  );
}
