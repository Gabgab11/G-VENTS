// Public settings, checked on first use so a missing variable fails loudly instead of as a vague Supabase error.
// Getters (not values computed at import) keep `next build` working without secrets: Next.js loads every
// route module while collecting page data, and a throw at import time would fail the whole build.
// NEXT_PUBLIC_* values must be read with literal property access so Next.js can inline them in the browser bundle.

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get siteUrl() {
    return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  },
};
