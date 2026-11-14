import "server-only";

import { notFound, redirect } from "next/navigation";
import { api } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";

// G-ventZ admin dashboard (Change 2, FR-21). The API is the gatekeeper: non-staff get 404 (the
// pages say "not found" too, so the admin area isn't revealed), staff without two-step sign-in get
// 403 auth.mfa_required and are sent to confirm with their authenticator app, then come back.

export async function adminCall<T>(work: () => Promise<T>, returnTo: string): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        // Not staff (yet): someone with an open invitation is sent to accept it instead of "not found".
        const invited = await hasStaffInvite();
        if (invited) redirect("/admin/invite");
        notFound();
      }
      if (error.code === "auth.mfa_required") redirect(`/account/security?next=${encodeURIComponent(returnTo)}`);
      if (error.status === 401) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
    }
    throw error;
  }
}

/** Integer minor units → "₦2,500.00", using the currency's own number of decimals. */
export function formatMinor(amountMinor: number, currency: string): string {
  try {
    const fmt = new Intl.NumberFormat("en-NG", { style: "currency", currency });
    const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
    return fmt.format(amountMinor / 10 ** digits);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

/** "₦2,500.00 · $40.00", or "—" when there is nothing. */
export function formatMoneyList(list: { currency: string; amountMinor: number }[]): string {
  const shown = list.filter((m) => m.amountMinor !== 0);
  return shown.length ? shown.map((m) => formatMinor(m.amountMinor, m.currency)).join(" · ") : "—";
}

export function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}), timeZone: "Africa/Lagos" });
}

/**
 * One CSV cell. Quotes when needed, and neutralises spreadsheet formulas: a value starting with
 * = + - @ (or a tab/return) gets a leading apostrophe, so opening the export can't run a formula
 * typed into an event title or a name (CSV injection).
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

async function hasStaffInvite(): Promise<boolean> {
  try {
    const res = await (await api()).GET("/v1/me/staff-invite");
    return !!res.data;
  } catch {
    return false;
  }
}
