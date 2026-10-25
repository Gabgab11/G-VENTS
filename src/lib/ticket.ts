import { headers } from "next/headers";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import type { components } from "@/lib/api/schema";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";

/** A ticket from gventz-api (U6a): the ticket page. */
export type Ticket = components["schemas"]["TicketViewResponse"];

const CODE = /^[0-9a-f]{24}$/;

export function isTicketCode(code: string): boolean {
  return CODE.test(code);
}

// One ticket by its code from gventz-api, with the viewer's token so staff see "Check in".
export async function getTicket(code: string): Promise<Ticket | null> {
  if (!isTicketCode(code)) return null;
  try {
    return data(await (await api()).GET("/v1/tickets/{code}", { params: { path: { code } } }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
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
