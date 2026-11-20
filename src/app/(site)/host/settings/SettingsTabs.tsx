"use client";

import { usePathname } from "next/navigation";
import { TabLink, TabLinks } from "@/design";

/** The settings sections as route tabs; the current one is marked from the address. */
export default function SettingsTabs({ label, tabs }: { label: string; tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <TabLinks aria-label={label}>
      {tabs.map((x) => <TabLink key={x.href} href={x.href} active={pathname === x.href}>{x.label}</TabLink>)}
    </TabLinks>
  );
}
