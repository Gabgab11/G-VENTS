import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

// Browser client: uses the public anon/publishable key only.
// Row-level security in the database controls what it can read and write.
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
}
