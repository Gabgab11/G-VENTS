import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

// Cookieless client for data every visitor sees the same way (published, public
// events). It never reads the session, so pages that use only this client can be
// rendered once and cached instead of on every request.
export function createSupabasePublicClient() {
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
