"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/hosts", label: "Hosts" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export default function AdminNav() {
  const path = usePathname();
  return (
    <nav className="ad-tabs" aria-label="Admin sections">
      {TABS.map((t) => {
        const on = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}>{t.label}</Link>;
      })}
    </nav>
  );
}
