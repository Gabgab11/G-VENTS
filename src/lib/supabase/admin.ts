import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Server-only client with the service-role key, which skips row-level security.
// Used for two things only: reading a guest's email to send their ticket again,
// and writing delivery logs. Never import this from a component or anything the
// browser loads. SUPABASE_SERVICE_ROLE_KEY must never start with NEXT_PUBLIC_.
export function adminConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createSupabaseAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
