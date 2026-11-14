import Link from "next/link";
import type { ReactNode } from "react";
import AccountLink from "@/app/AccountLink";
import BackLink from "@/components/BackLink";
import ColorModeToggle from "@/components/ColorModeToggle";

const NAV = [
  { href: "/discover", label: "Discover" },
  { href: "/pricing", label: "Pricing" },
  { href: "/events/new", label: "Create event" },
] as const;

// The header on every page except the home page (which has its own): a back arrow, the logo (home),
// the main links, the colour switch and Sign in / Dashboard. `back` is where the arrow goes when
// there's no history to go back to; `actions` replaces the account link (the dashboard puts
// Sign out there).
export default function SiteHeader({
  back = "/",
  current,
  actions,
}: {
  back?: string | false;
  current?: (typeof NAV)[number]["href"];
  actions?: ReactNode;
}) {
  return (
    <header className="site-top">
      {back !== false && <BackLink fallback={back} label="←" />}
      <Link href="/" className="site-logo" aria-label="G-ventZ home">G-vent<b>Z</b></Link>
      <nav className="site-nav" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={current === n.href ? "page" : undefined}>{n.label}</Link>
        ))}
      </nav>
      <div className="site-actions">
        <ColorModeToggle />
        {actions ?? <AccountLink className="site-account" />}
      </div>
    </header>
  );
}
