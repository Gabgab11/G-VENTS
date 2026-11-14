"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/lib/api/server";
import { ApiError, apiMessage } from "@/lib/api/problem";
import { isUuid } from "@/lib/forms";

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
