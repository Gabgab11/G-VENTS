import type { PostgrestError } from "@supabase/supabase-js";

// Messages raised on purpose by our database functions (RAISE EXCEPTION, code P0001)
// are written for people and can be shown as they are. Anything else is an internal
// error: log the detail on the server and show a generic message.
export function userMessage(error: Pick<PostgrestError, "code" | "message"> | null | undefined, fallback: string): string {
  if (!error) return fallback;
  if (error.code === "P0001" && error.message) return error.message;
  console.error(`[db] ${error.code ?? "unknown"}: ${error.message}`);
  return fallback;
}
