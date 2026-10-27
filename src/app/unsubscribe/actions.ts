"use server";

import { unsubscribe, type UnsubscribeResult } from "@/lib/unsubscribe";

export type UnsubscribeState = UnsubscribeResult | undefined;

export async function confirmUnsubscribe(_prev: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  return unsubscribe(String(formData.get("token") ?? "").toLowerCase());
}
