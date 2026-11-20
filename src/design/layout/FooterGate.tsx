"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Pages that are full-screen tools, where the footer would get in the way: the door scanner. */
export function hidesFooter(pathname: string): boolean {
  return /\/events\/[^/]+\/scan$/.test(pathname);
}

/** Renders the site footer (passed as children, so it stays a server component) on every page but those. */
export default function FooterGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return hidesFooter(pathname ?? "") ? null : <>{children}</>;
}
