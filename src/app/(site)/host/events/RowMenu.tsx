"use client";

import NextLink from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/design";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/design/client";

type Labels = { more: string; manage: string; edit: string; view: string; scan: string };

// The ⋯ menu on an events-list row: manage and edit; on phones also View page and Scan, whose
// inline buttons are hidden there (the row becomes a card).
export default function RowMenu({ id, viewHref, scan, edit, labels }: { id: string; viewHref: string | null; scan: boolean; edit: boolean; labels: Labels }) {
  return (
    <Menu>
      <MenuTrigger>
        <Button size="sm" variant="ghost" icon={<MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />} aria-label={labels.more} />
      </MenuTrigger>
      <MenuContent>
        <MenuItem asChild><NextLink href={`/host/events/${id}`}>{labels.manage}</NextLink></MenuItem>
        {edit && <MenuItem asChild><NextLink href={`/host/events/${id}?tab=details`}>{labels.edit}</NextLink></MenuItem>}
        {(viewHref || scan) && <MenuSeparator />}
        {viewHref && <MenuItem asChild><a href={viewHref}>{labels.view}</a></MenuItem>}
        {scan && <MenuItem asChild><NextLink href={`/host/events/${id}/scan`}>{labels.scan}</NextLink></MenuItem>}
      </MenuContent>
    </Menu>
  );
}
