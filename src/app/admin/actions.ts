"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/lib/api/server";
import { ApiError, apiMessage } from "@/lib/api/problem";
import { isUuid } from "@/lib/forms";
import { percentToBps } from "@/lib/money";
import { PAYOUT_COUNTRIES, isPayoutCountry } from "@/lib/payment-text";

// Staff actions (FR-21). The API checks staff + two-step sign-in and audits each one; these read
// the form, call it, and come back to the page with a short message in the URL.

function back(path: string, query: string): never {
  revalidatePath("/admin", "layout");
  redirect(`${path}${path.includes("?") ? "&" : "?"}${query}`);
}

async function run(path: string, work: () => Promise<unknown>, ok: string): Promise<never> {
  try {
    await work();
  } catch (error) {
    if (error instanceof ApiError && error.code === "auth.mfa_required") redirect(`/account/security?next=${encodeURIComponent(path)}`);
    back(path, `err=${encodeURIComponent(apiMessage(error, "That didn't work. Please try again."))}`);
  }
  back(path, `ok=${encodeURIComponent(ok)}`);
}

function text(formData: FormData, name: string, max = 500): string {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

export async function suspendHost(formData: FormData) {
  const id = text(formData, "host_id");
  const reason = text(formData, "reason");
  const path = `/admin/hosts/${id}`;
  if (!isUuid(id)) back("/admin/hosts", "err=Unknown%20host");
  if (reason.length < 3) back(path, "err=Give%20a%20reason%20for%20suspending");
  await run(path, async () => (await api()).POST("/v1/admin/hosts/{id}/suspend", { params: { path: { id } }, body: { reason } }), "Host suspended");
}

export async function unsuspendHost(formData: FormData) {
  const id = text(formData, "host_id");
  if (!isUuid(id)) back("/admin/hosts", "err=Unknown%20host");
  await run(`/admin/hosts/${id}`, async () => (await api()).POST("/v1/admin/hosts/{id}/unsuspend", { params: { path: { id } } }), "Suspension lifted");
}

export async function unpublishEvent(formData: FormData) {
  const id = text(formData, "event_id");
  const returnTo = text(formData, "return_to") || "/admin/events";
  if (!isUuid(id)) back(returnTo, "err=Unknown%20event");
  await run(returnTo, async () => (await api()).POST("/v1/admin/events/{id}/unpublish", { params: { path: { id } }, body: {} }), "Event unpublished (now a draft)");
}

export async function cancelEvent(formData: FormData) {
  const id = text(formData, "event_id");
  const reason = text(formData, "reason");
  const returnTo = text(formData, "return_to") || "/admin/events";
  if (!isUuid(id)) back(returnTo, "err=Unknown%20event");
  if (formData.get("confirm") !== "yes") back(returnTo, "err=Tick%20the%20box%20to%20confirm%20the%20cancellation");
  if (reason.length < 3) back(returnTo, "err=Give%20a%20reason%20for%20cancelling");
  await run(returnTo, async () => (await api()).POST("/v1/admin/events/{id}/cancel", { params: { path: { id } }, body: { reason } }), "Event cancelled");
}

const PROVIDERS = ["paystack", "interswitch", "stripe"] as const;

export async function setProvider(formData: FormData) {
  const provider = text(formData, "provider") as (typeof PROVIDERS)[number];
  if (!PROVIDERS.includes(provider)) back("/admin/settings", "err=Unknown%20provider");
  const enabled = formData.get("enabled") === "true";
  await run("/admin/settings", async () => (await api()).PATCH("/v1/admin/settings", { body: { payments: { [provider]: { enabled } } } }),
    `${provider[0]!.toUpperCase()}${provider.slice(1)} ${enabled ? "switched on" : "switched off"}`);
}

export async function setFee(formData: FormData) {
  const currency = text(formData, "currency", 3).toUpperCase();
  const percent = Number(text(formData, "percent", 10) || "0");
  const fixed = Number(text(formData, "fixed", 15) || "0");
  if (!/^[A-Z]{3}$/.test(currency)) back("/admin/settings", "err=Use%20a%203-letter%20currency%20code%20(e.g.%20NGN)");
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) back("/admin/settings", "err=The%20percentage%20must%20be%20between%200%20and%20100");
  if (!Number.isFinite(fixed) || fixed < 0) back("/admin/settings", "err=The%20fixed%20amount%20can't%20be%20negative");
  const percentBps = Math.round(percent * 100);
  const fixedMinor = Math.round(fixed * 100);
  await run("/admin/settings", async () => (await api()).PATCH("/v1/admin/settings", { body: { fees: { [currency]: { percentBps, fixedMinor } } } }), `Fee for ${currency} saved`);
}

export async function setSettlementDelay(formData: FormData) {
  const days = Number(text(formData, "days", 3));
  if (!Number.isInteger(days) || days < 0 || days > 30) back("/admin/settings", "err=Choose%200%20to%2030%20working%20days");
  await run("/admin/settings", async () => (await api()).PATCH("/v1/admin/settings", { body: { settlementDelayWorkingDays: days } }), "Settlement delay saved");
}

function feeFrom(formData: FormData): { percentBps: number; fixedMinor: number } {
  const percent = Number(text(formData, "percent", 10) || "0");
  const fixed = Number(text(formData, "fixed", 15) || "0");
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) back("/admin/settings", "err=The%20percentage%20must%20be%20between%200%20and%20100");
  if (!Number.isFinite(fixed) || fixed < 0) back("/admin/settings", "err=The%20fixed%20amount%20can't%20be%20negative");
  return { percentBps: Math.round(percent * 100), fixedMinor: Math.round(fixed * 100) };
}

/** The standard G-ventZ fee, used for every currency without its own rate. */
export async function setDefaultFee(formData: FormData) {
  const fee = feeFrom(formData);
  await run("/admin/settings", async () => (await api()).PATCH("/v1/admin/settings", { body: { defaultFee: fee } }), "Standard fee saved");
}

export async function clearDefaultFee() {
  await run("/admin/settings", async () => (await api()).PATCH("/v1/admin/settings", { body: { defaultFee: null } }), "Standard fee removed (currencies without their own rate now pay no fee)");
}

/** Removes a currency's own rate, so it falls back to the standard fee. */
export async function removeFee(formData: FormData) {
  const currency = text(formData, "currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) back("/admin/settings", "err=Unknown%20currency");
  await run("/admin/settings", async () => (await api()).PATCH("/v1/admin/settings", { body: { fees: { [currency]: null } } }), `${currency} now uses the standard fee`);
}

// Platform staff (FR-21.7): invite, withdraw an invite, remove a member, accept an invite.

export async function inviteStaff(formData: FormData) {
  const email = text(formData, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) back("/admin/settings", "err=Enter%20a%20valid%20email%20address");
  await run("/admin/settings", async () => (await api()).POST("/v1/admin/staff/invites", { body: { email } }), `Invitation sent to ${email}`);
}

export async function revokeInvite(formData: FormData) {
  const id = text(formData, "invite_id");
  if (!isUuid(id)) back("/admin/settings", "err=Unknown%20invitation");
  await run("/admin/settings", async () => (await api()).DELETE("/v1/admin/staff/invites/{id}", { params: { path: { id } } }), "Invitation withdrawn");
}

export async function removeStaff(formData: FormData) {
  const email = text(formData, "email", 254).toLowerCase();
  if (formData.get("confirm") !== "yes") back("/admin/settings", "err=Tick%20the%20box%20to%20confirm%20the%20removal");
  await run("/admin/settings", async () => (await api()).DELETE("/v1/admin/staff/{email}", { params: { path: { email } } }), `${email} is no longer staff`);
}

export async function acceptStaffInvite() {
  try {
    await (await api()).POST("/v1/me/staff-invite/accept");
  } catch (error) {
    redirect(`/admin/invite?err=${encodeURIComponent(apiMessage(error, "That invitation couldn't be accepted."))}`);
  }
  // Staff need two-step sign-in before the dashboard opens; the security page sends them on.
  redirect("/account/security?next=/admin");
}

// ---- Paystack (M5): host applications, countries, VAT ----

function applicationPath(formData: FormData): { id: string; path: string } {
  const id = text(formData, "application_id");
  if (!isUuid(id)) back("/admin/hosts", "err=Unknown%20application");
  return { id, path: `/admin/hosts/applications/${id}` };
}

/** HA2/HA3: approve; the API then creates the host's Paystack subaccount (or leaves it pending). */
export async function approveApplication(formData: FormData) {
  const { id, path } = applicationPath(formData);
  await run(path, async () => (await api()).POST("/v1/admin/host-applications/{id}/approve", { params: { path: { id } } }), "Approved. The host has been emailed.");
}

export async function declineApplication(formData: FormData) {
  const { id, path } = applicationPath(formData);
  const reason = text(formData, "reason");
  if (reason.length < 3) back(path, "err=Give%20the%20host%20a%20reason%20(3%20to%20500%20characters)");
  await run(path, async () => (await api()).POST("/v1/admin/host-applications/{id}/decline", { params: { path: { id } }, body: { reason } }), "Declined. The host has been emailed the reason.");
}

/** HA5: no new paid tickets or orders; what was sold stays valid. */
export async function revokeApplication(formData: FormData) {
  const { id, path } = applicationPath(formData);
  const reason = text(formData, "reason");
  if (formData.get("confirm") !== "yes") back(path, "err=Tick%20the%20box%20to%20confirm");
  if (reason.length < 3) back(path, "err=Give%20a%20reason%20(3%20to%20500%20characters)");
  await run(path, async () => (await api()).POST("/v1/admin/host-applications/{id}/revoke", { params: { path: { id } }, body: { reason } }), "Approval withdrawn");
}

export async function retryPayoutAccount(formData: FormData) {
  const { id, path } = applicationPath(formData);
  await run(path, async () => (await api()).POST("/v1/admin/host-applications/{id}/retry-payout-account", { params: { path: { id } } }), "Payout account request sent to Paystack");
}

/** PR2: Paystack on or off per country (refused by the API while that country's keys aren't set). */
export async function setPaystackCountry(formData: FormData) {
  const country = text(formData, "country", 2).toUpperCase();
  if (!isPayoutCountry(country)) back("/admin/settings", "err=Unknown%20country");
  const enabled = formData.get("enabled") === "true";
  await run("/admin/settings", async () => (await api()).PATCH("/v1/admin/settings", { body: { paystackCountries: { [country]: { enabled } } } }),
    `Paystack ${enabled ? "switched on" : "switched off"} for ${PAYOUT_COUNTRIES[country].name}`);
}

/** FE2: VAT on the G-ventZ fee, per currency. */
export async function setVat(formData: FormData) {
  const currency = text(formData, "currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) back("/admin/settings", "err=Use%20a%203-letter%20currency%20code%20(e.g.%20NGN)");
  const rateBps = percentToBps(text(formData, "percent", 10));
  if (rateBps === null) back("/admin/settings", "err=VAT%20must%20be%20between%200%20and%20100%25%2C%20up%20to%202%20decimals");
  await run("/admin/settings", async () => (await api()).PATCH("/v1/admin/settings", { body: { vat: { [currency]: { rateBps } } } }), `VAT for ${currency} saved`);
}

export async function removeVat(formData: FormData) {
  const currency = text(formData, "currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) back("/admin/settings", "err=Unknown%20currency");
  await run("/admin/settings", async () => (await api()).PATCH("/v1/admin/settings", { body: { vat: { [currency]: null } } }), `${currency} VAT removed (0%)`);
}
