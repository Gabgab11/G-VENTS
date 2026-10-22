import { headers } from "next/headers";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_TIMEZONE } from "@/lib/dates";

export type TicketStatus = "pending" | "confirmed" | "waitlisted" | "cancelled" | "refunded";

export type Ticket = {
  id: string;
  code: string;
  name: string;
  status: TicketStatus;
  checked_in_at: string | null;
  created_at: string;
  tier: { name: string; price_minor: number; currency: string };
  event: {
    title: string;
    slug: string;
    starts_at: string;
    ends_at: string | null;
    timezone: string;
    is_online: boolean;
    venue_name: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    status: "draft" | "published" | "cancelled";
    refund_policy: string | null;
  };
  can_check_in: boolean;
};

const CODE = /^[0-9a-f]{24}$/;

export function isTicketCode(code: string): boolean {
  return CODE.test(code);
}

// Reads one ticket by its code. See get_ticket in supabase/migrations.
export async function getTicket(supabase: SupabaseServerClient, code: string): Promise<Ticket | null> {
  if (!isTicketCode(code)) return null;
  const { data, error } = await supabase.rpc("get_ticket", { p_code: code });
  if (error) throw new Error(`Could not load ticket: ${error.message}`);
  return (data as Ticket | null) ?? null;
}

// "9F3C 2A71 B0E4 D5C6 A7B8 C9D0": easier to read out at the door.
export function displayCode(code: string): string {
  return code.toUpperCase().replace(/(.{4})(?=.)/g, "$1 ");
}

function format(iso: string, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return date.toLocaleString("en-GB", { ...options, timeZone: timeZone || DEFAULT_TIMEZONE });
  } catch {
    return date.toLocaleString("en-GB", { ...options, timeZone: DEFAULT_TIMEZONE });
  }
}

// "Saturday 7 November 2026"
export function ticketDate(iso: string, timeZone: string): string {
  return format(iso, timeZone, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// "18:00"
export function ticketTime(iso: string, timeZone: string): string {
  return format(iso, timeZone, { hour: "2-digit", minute: "2-digit" });
}

export function ticketPlace(event: Ticket["event"]): string {
  if (event.is_online) return "Online";
  const parts = [event.venue_name, event.address, event.city, event.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Venue to be announced";
}

export function ticketPrice(tier: Ticket["tier"]): string {
  if (tier.price_minor === 0) return "Free";
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: tier.currency }).format(tier.price_minor / 100);
  } catch {
    return `${tier.currency} ${(tier.price_minor / 100).toFixed(2)}`;
  }
}

// The address people use to reach the site, for links in QR codes and emails.
// NEXT_PUBLIC_SITE_URL wins when it is set to a real address, then Vercel's
// production domain; otherwise (previews, local) the request's own host is used,
// so preview deployments link to themselves.
export async function siteOrigin(): Promise<string> {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  if (configured && !configured.includes("localhost")) return configured;
  // Production links never come from request headers, which a client can set.
  // Vercel provides the production domain itself.
  const production = process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return configured || "http://localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function ticketUrl(origin: string, code: string): string {
  return `${origin}/t/${code}`;
}
