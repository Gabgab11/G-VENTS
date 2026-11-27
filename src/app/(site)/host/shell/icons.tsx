import {
  Banknote, CalendarDays, Compass, Home, Megaphone, Palette, ScanLine, Settings, Shield, ShieldCheck, UserRound, Users,
} from "lucide-react";
import type { NavKey } from "./nav";

export const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;

const COMPONENTS = {
  home: Home, events: CalendarDays, orders: Users, scan: ScanLine, payouts: Banknote, promote: Megaphone, profile: UserRound,
  settings: Settings, security: ShieldCheck, appearance: Palette, discover: Compass, admin: Shield,
} satisfies Record<NavKey, unknown>;

export function NavIcon({ name }: { name: NavKey }) {
  const C = COMPONENTS[name];
  return <C {...ICON} />;
}
