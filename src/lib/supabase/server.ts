import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { env, supabaseSecretKey } from "@/lib/env";
import { onCloudflare } from "@/lib/platform";
import { authCookieOptions, forwardedIp, supabaseKeyAndHeaders } from "./options";
import type { Database } from "./database.types";

// Server client for Server Components, Route Handlers, and Server Actions. Supabase is used for
// sign-in only (data comes from gventz-api), so only `auth` is handed out: with the secret key a
// data query would skip RLS, and this makes one impossible to write by accident.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const incoming = await headers();
  const { key, headers: extra } = supabaseKeyAndHeaders({
    secretKey: supabaseSecretKey(),
    publishableKey: env.supabaseAnonKey,
    ip: forwardedIp((name) => incoming.get(name), onCloudflare()),
  });

  const client = createServerClient<Database>(env.supabaseUrl, key, {
    cookieOptions: authCookieOptions(env.siteUrl),
    global: { headers: extra },
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
          // Called from a Server Component, which can't set cookies; middleware refreshes the session instead.
        }
      },
    },
  });
  return { auth: client.auth };
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
