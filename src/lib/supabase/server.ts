import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server client for Server Components, Route Handlers, and Server Actions.
// Reads the signed-in user from cookies, so RLS applies to the real user.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; the proxy refreshes sessions instead.
          }
        },
      },
    }
  );
}
