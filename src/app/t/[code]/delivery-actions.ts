"use server";

import { redirect } from "next/navigation";
import { api, data } from "@/lib/api/server";
import { ApiError } from "@/lib/api/problem";
import { isTicketCode } from "@/lib/ticket";

// "Email my ticket" on the ticket page, through gventz-api. The API sends it only to the address
// the ticket was registered with (never one from the form), at most 5 times an hour per ticket.
export async function sendTicketByEmail(formData: FormData) {
  const code = String(formData.get("code") ?? "").toLowerCase();
  if (!isTicketCode(code)) redirect("/");
  // Explicit `never` so TypeScript knows the code below only runs when the checks pass.
  function back(state: string): never {
    redirect(`/t/${code}?email=${state}`);
  }

  if (formData.get("confirm") !== "yes") back("confirm");

  let state = "sent";
  try {
    data(await (await api({ anonymous: true })).POST("/v1/tickets/{code}/email", { params: { path: { code } } }));
  } catch (error) {
    if (error instanceof ApiError && error.code === "ticket.email_limit") state = "limit";
    else if (error instanceof ApiError && (error.code === "ticket.email_unavailable" || error.status === 404)) state = "unavailable";
    else {
      console.error("[ticket] email my ticket:", error);
      state = "failed";
    }
  }
  back(state);
}
