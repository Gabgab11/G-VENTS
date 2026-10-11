"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/categories";

export type CreateEventState = { error?: string } | undefined;

function randomSuffix(length = 5) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function makeSlug(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "event"}-${randomSuffix()}`;
}

export async function createEvent(
  _prev: CreateEventState,
  formData: FormData
): Promise<CreateEventState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/events/new");

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const venue = String(formData.get("venue") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const refundPolicy = String(formData.get("refund_policy") ?? "").trim();
  const intent = String(formData.get("intent") ?? "draft");

  const tierNames = formData.getAll("tier_name").map(String);
  const tierPrices = formData.getAll("tier_price").map(String);
  const tierQty = formData.getAll("tier_qty").map(String);

  if (title.length < 3 || title.length > 140) return { error: "Event name must be 3 to 140 characters." };
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) return { error: "Choose a category." };
  if (!date || !time) return { error: "Add a date and start time." };

  // Lagos time is UTC+1 all year, so the stored time is correct without a timezone lookup.
  const startsAt = new Date(`${date}T${time}:00+01:00`);
  if (Number.isNaN(startsAt.getTime())) return { error: "The date or time is not valid." };

  const tiers: { name: string; price_minor: number; quantity: number | null }[] = [];
  for (let i = 0; i < tierNames.length; i++) {
    const name = tierNames[i].trim();
    if (!name) return { error: "Every ticket needs a name." };
    const price = Number(tierPrices[i] || 0);
    if (!Number.isInteger(price) || price < 0) return { error: `The price for "${name}" must be a whole number, 0 or more.` };
    const qtyRaw = (tierQty[i] || "").trim();
    const qty = qtyRaw === "" ? null : Number(qtyRaw);
    if (qty !== null && (!Number.isInteger(qty) || qty <= 0)) return { error: `The quantity for "${name}" must be a whole number above 0.` };
    // Prices are entered in whole naira and stored in kobo (smallest unit).
    tiers.push({ name, price_minor: price * 100, quantity: qty });
  }
  if (tiers.length === 0) return { error: "Add at least one ticket." };

  const slug = makeSlug(title);

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      owner_id: user.id,
      title,
      slug,
      category,
      description: description || null,
      starts_at: startsAt.toISOString(),
      timezone: "Africa/Lagos",
      venue_name: venue || null,
      city: city || null,
      country: country || null,
      refund_policy: refundPolicy || null,
      status: intent === "publish" ? "published" : "draft",
    })
    .select("id, slug")
    .single();

  if (eventError || !event) return { error: eventError?.message ?? "Could not save the event." };

  const { error: tierError } = await supabase.from("ticket_tiers").insert(
    tiers.map((t) => ({ ...t, event_id: event.id, currency: "NGN" }))
  );

  if (tierError) {
    // Roll back the event so there is no half-created record.
    await supabase.from("events").delete().eq("id", event.id);
    return { error: tierError.message };
  }

  redirect(`/e/${event.slug}`);
}
