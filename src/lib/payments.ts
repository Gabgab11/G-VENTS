import "server-only";

import { api, data } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";

export type Availability = components["schemas"]["PaymentsAvailabilityDto"];
export type MyHostApplication = components["schemas"]["MyHostApplicationDto"];

/**
 * Whether paid tickets are on and whether this caller can sell them (M5). Null when the API can't
 * say (then pages treat paid tickets as unavailable rather than failing the whole page).
 */
export async function getAvailability(): Promise<Availability | null> {
  try {
    return data(await (await api()).GET("/v1/payments/availability"));
  } catch (error) {
    console.error(`[payments] availability: ${(error as Error).message}`);
    return null;
  }
}

/** The signed-in host's application to sell paid tickets; null when the API can't say. */
export async function getMyHostApplication(): Promise<MyHostApplication | null> {
  try {
    return data(await (await api()).GET("/v1/me/host-application"));
  } catch (error) {
    console.error(`[payments] host application: ${(error as Error).message}`);
    return null;
  }
}
