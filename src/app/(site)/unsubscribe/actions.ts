"use server";

import { unsubscribe, unsubscribeHost, type HostUnsubscribeResult, type UnsubscribeResult } from "@/lib/unsubscribe";

export type UnsubscribeState = (UnsubscribeResult & { kind: "event" }) | (HostUnsubscribeResult & { kind: "host" }) | undefined;

export async function confirmUnsubscribe(_prev: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  const token = String(formData.get("token") ?? "").toLowerCase();
  if (formData.get("kind") === "host") return { kind: "host", ...(await unsubscribeHost(token)) };
  return { kind: "event", ...(await unsubscribe(token)) };
}
