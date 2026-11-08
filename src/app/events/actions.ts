"use server";

import { redirect } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { apiMessage } from "@/lib/api/problem";
import { requireUser } from "@/lib/auth";
import { createEventBody } from "./create-event-input";

export type CreateEventState = { error?: string } | undefined;

// Creates the event through gventz-api (U6a). The API derives the time zone from the venue where
// it can, checks every event rule, and answers with a message the form can show.
export async function createEvent(_prev: CreateEventState, formData: FormData): Promise<CreateEventState> {
  await requireUser("/events/new");
  const body = createEventBody(formData);
  if ("error" in body) return { error: body.error };

  let slug: string;
  try {
    slug = data(await (await api()).POST("/v1/events", { body })).slug;
  } catch (error) {
    return { error: apiMessage(error, "We couldn't save the event. Please try again.") };
  }
  redirect(body.publish ? `/e/${slug}` : "/dashboard");
}
