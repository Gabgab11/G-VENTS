import { createBrowserClient } from "@supabase/ssr";

// Browser client: uses the public anon/publishable key only.
// Row-level security in the database controls what it can read and write.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
