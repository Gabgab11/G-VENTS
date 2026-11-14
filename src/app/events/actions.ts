"use server";

import { redirect } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { apiMessage } from "@/lib/api/problem";
import { requireUser } from "@/lib/auth";
import { flyerFrom, uploadFlyer } from "@/lib/flyer";
import { createEventBody } from "./create-event-input";

export type CreateEventState = { error?: string } | undefined;

const FLYER_PROBLEMS = {
  flyer_missing: "Choose an image first.",
  flyer_type: "Use a JPG, PNG, or WebP image for the event image.",
  flyer_size: "The event image is larger than 5 MB. Please resize it and try again.",
} as const;

// Creates the event through gventz-api (U6a). The API derives the time zone from the venue where
// it can, checks every event rule, and answers with a message the form can show.
// An event image, if chosen, is checked first and uploaded once the event exists (U5). If only the
// image fails, the event is kept and the host lands on its settings to try the image again.
export async function createEvent(_prev: CreateEventState, formData: FormData): Promise<CreateEventState> {
  await requireUser("/events/new");
  const body = createEventBody(formData);
  if ("error" in body) return { error: body.error };
  const flyer = flyerFrom(formData);
  if (flyer && "problem" in flyer) return { error: FLYER_PROBLEMS[flyer.problem] };

  let created: { id: string; slug: string };
  try {
    created = data(await (await api()).POST("/v1/events", { body }));
  } catch (error) {
    return { error: apiMessage(error, "We couldn't save the event. Please try again.") };
  }

  if (flyer) {
    try {
      await uploadFlyer(created.id, flyer.file, flyer.contentType);
    } catch (error) {
      console.error(`[create event] image upload failed: ${(error as Error).message}`);
      redirect(`/dashboard/${created.id}?tab=settings&err=flyer_after_create`);
    }
  }
  redirect(body.publish ? `/e/${created.slug}` : "/dashboard");
}
