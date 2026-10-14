"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isCategory } from "@/lib/categories";
import { isThemeKey } from "@/lib/themes";
import { DEFAULT_TIMEZONE, zonedTimeToUtc } from "@/lib/dates";
import { checkbox, field } from "@/lib/forms";
import { userMessage } from "@/lib/errors";

export type CreateEventState = { error?: string } | undefined;

const MAX_TIERS = 20;

function makeSlug(title: string) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  // 5 random base-36 characters: enough that slugs can't be guessed or collide in practice.
  const suffix = Array.from(randomBytes(5), (b) => (b % 36).toString(36)).join("");
  return `${base || "event"}-${suffix}`;
}

export async function createEvent(_prev: CreateEventState, formData: FormData): Promise<CreateEventState> {
  const { supabase } = await requireUser("/events/new");

  const title = field(formData, "title", 140);
  const category = field(formData, "category");
  const theme = field(formData, "cover_theme");
  const intent = field(formData, "intent") === "publish" ? "publish" : "draft";
  const timezone = DEFAULT_TIMEZONE;

  if (title.length < 3) return { error: "Event name must be 3 to 140 characters." };
  if (!isCategory(category)) return { error: "Choose a category." };

  const date = field(formData, "date");
  const time = field(formData, "time");
  if (!date || !time) return { error: "Add a start date and time." };
  const startsAt = zonedTimeToUtc(date, time, timezone);
  if (!startsAt) return { error: "The start date or time is not valid." };

  let endsAt: Date | null = null;
  const endDate = field(formData, "end_date");
  const endTime = field(formData, "end_time");
  if (endDate || endTime) {
    if (!endDate || !endTime) return { error: "Add both an end date and an end time, or leave both empty." };
    endsAt = zonedTimeToUtc(endDate, endTime, timezone);
    if (!endsAt || endsAt <= startsAt) return { error: "The end must be after the start." };
  }

  const tierNames = formData.getAll("tier_name").map(String);
  const tierQty = formData.getAll("tier_qty").map(String);
  const tiers: { name: string; price_minor: number; quantity: number | null }[] = [];
  for (let i = 0; i < tierNames.length; i++) {
    const name = tierNames[i].trim().slice(0, 80);
    if (!name) continue;
    const qtyRaw = (tierQty[i] ?? "").trim();
    const qty = qtyRaw === "" ? null : Number(qtyRaw);
    if (qty !== null && (!Number.isInteger(qty) || qty <= 0)) return { error: `The quantity for "${name}" must be a whole number above 0.` };
    // Paid tickets are switched off until payments exist, so every ticket is free.
    tiers.push({ name, price_minor: 0, quantity: qty });
  }
  if (tiers.length === 0) return { error: "Add at least one ticket." };
  if (tiers.length > MAX_TIERS) return { error: `Add at most ${MAX_TIERS} ticket types.` };

  // Event and tickets are written in one transaction, so a failure never leaves half an event.
  const { data: event, error } = await supabase.rpc("create_event_with_tiers", {
    p_event: {
      title,
      slug: makeSlug(title),
      category,
      description: field(formData, "description"),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
      timezone,
      venue_name: field(formData, "venue", 300),
      city: field(formData, "city", 120),
      country: field(formData, "country", 120),
      refund_policy: field(formData, "refund_policy", 2000),
      visibility: field(formData, "visibility") === "private" ? "private" : "public",
      show_attendee_count: checkbox(formData, "show_attendee_count"),
      require_approval: checkbox(formData, "require_approval"),
      cover_theme: isThemeKey(theme) ? theme : "minimal",
      status: intent === "publish" ? "published" : "draft",
    },
    p_tiers: tiers,
  });

  if (error || !event) return { error: userMessage(error, "We couldn't save the event. Please try again.") };

  const saved = event as { slug: string };
  redirect(intent === "publish" ? `/e/${saved.slug}` : "/dashboard");
}
