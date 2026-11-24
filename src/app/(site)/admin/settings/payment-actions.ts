"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/lib/api/server";
import { ApiError, apiMessage } from "@/lib/api/problem";
import { majorToMinor, percentToBps } from "@/lib/money";
import { PAYOUT_COUNTRIES, PAYSTACK_COUNTRIES, PROVIDER_NAMES, isPayoutCountry, isProviderId, type PayoutCountry, type ProviderId } from "@/lib/payment-text";

// Payment switches (Change 5 chunk 4, PS1–PS3, PS9, PS15). The API checks staff + two-step sign-in,
// the rules and audits each change; these read the form, call it, and come back to the settings
// page with a short message in the URL (as the other staff actions do).

const PAGE = "/admin/settings";

function back(query: string): never {
  revalidatePath("/admin", "layout");
  redirect(`${PAGE}?${query}#payments`);
}

async function run(work: () => Promise<unknown>, ok: string): Promise<never> {
  try {
    await work();
  } catch (error) {
    if (error instanceof ApiError && error.code === "auth.mfa_required") redirect(`/host/settings/security?next=${encodeURIComponent(PAGE)}`);
    back(`err=${encodeURIComponent(apiMessage(error, "That didn't work. Please try again."))}`);
  }
  back(`ok=${encodeURIComponent(ok)}`);
}

function text(formData: FormData, name: string, max = 500): string {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function providerFrom(formData: FormData): ProviderId {
  const provider = text(formData, "provider", 20);
  if (!isProviderId(provider)) back("err=Unknown%20provider");
  return provider;
}

const isPaystackCountry = (c: PayoutCountry) => (PAYSTACK_COUNTRIES as readonly string[]).includes(c);

/** PS3: a provider on or off (the API refuses switching off the active one). */
export async function setProviderEnabled(formData: FormData) {
  const provider = providerFrom(formData);
  const enabled = formData.get("enabled") === "true";
  await run(async () => (await api()).PATCH("/v1/admin/settings", { body: { payments: { [provider]: { enabled } } } }),
    `${PROVIDER_NAMES[provider]} ${enabled ? "switched on" : "switched off"}`);
}

/** PS9: a provider's country on or off (switching on needs keys, a G-ventZ fee, a VAT row and confirmed charges). */
export async function setProviderCountry(formData: FormData) {
  const provider = providerFrom(formData);
  const country = text(formData, "country", 2).toUpperCase();
  if (!isPayoutCountry(country) || (provider === "paystack" && !isPaystackCountry(country))) back("err=Unknown%20country");
  const enabled = formData.get("enabled") === "true";
  const change = { [country]: { enabled } };
  await run(async () => (await api()).PATCH("/v1/admin/settings", { body: provider === "paystack" ? { paystackCountries: change } : { flutterwaveCountries: change } }),
    `${PROVIDER_NAMES[provider]} ${enabled ? "switched on" : "switched off"} for ${PAYOUT_COUNTRIES[country].name}`);
}

/** PS15: a charge schedule, typed in the currency's main unit; saving confirms it. */
export async function saveChargeSchedule(formData: FormData) {
  const provider = providerFrom(formData);
  const country = text(formData, "country", 2).toUpperCase();
  if (!isPayoutCountry(country) || (provider === "paystack" && !isPaystackCountry(country))) back("err=Unknown%20country");
  const { currency, name } = PAYOUT_COUNTRIES[country];
  const percentBps = percentToBps(text(formData, "percent", 10));
  if (percentBps === null) back("err=The%20percentage%20must%20be%20between%200%20and%20100%2C%20up%20to%202%20decimals");
  const amount = (field: string, label: string, optional = false): number | null => {
    const raw = text(formData, field, 20);
    if (optional && raw === "") return null;
    const minor = majorToMinor(raw === "" ? "0" : raw, currency);
    if (minor === null) back(`err=${encodeURIComponent(`${label}: enter an amount in ${currency}, with no more decimals than ${currency} has`)}`);
    return minor;
  };
  const fixedMinor = amount("fixed", "Fixed amount")!;
  const waiveFixedBelow = amount("waive_below", "Fixed part applies from")!;
  const capMinor = amount("cap", "Cap", true);
  await run(async () => (await api()).PATCH("/v1/admin/settings", { body: { providerCharges: { [provider]: { [country]: { percentBps, fixedMinor, waiveFixedBelow, capMinor } } } } }),
    `${PROVIDER_NAMES[provider]}'s charge for ${name} saved and confirmed`);
}

export type ActiveProviderState = { error?: string } | undefined;

/**
 * PS1, PS2: the provider new checkouts use first; needs a reason (10 to 500 characters), kept in the
 * audit log. Errors come back to the dialog; success goes back to the page.
 */
export async function setActiveProvider(_prev: ActiveProviderState, formData: FormData): Promise<ActiveProviderState> {
  const provider = text(formData, "provider", 20);
  if (!isProviderId(provider)) return { error: "Unknown provider." };
  const reason = text(formData, "reason");
  if (reason.length < 10) return { error: "Give a reason of 10 to 500 characters." };
  try {
    await (await api()).PATCH("/v1/admin/settings", { body: { activeProvider: provider, reason } });
  } catch (error) {
    if (error instanceof ApiError && error.code === "auth.mfa_required") redirect(`/host/settings/security?next=${encodeURIComponent(PAGE)}`);
    return { error: apiMessage(error, "That didn't work. Please try again.") };
  }
  back(`ok=${encodeURIComponent(`${PROVIDER_NAMES[provider]} is now the active provider. Orders already started finish on their current provider.`)}`);
}
