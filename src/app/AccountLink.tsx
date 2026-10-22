"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// The home page is cached and shared by every visitor, so whether to show
// "Sign in" or "Dashboard" is decided in the browser. A Supabase session cookie
// (sb-<project>-auth-token) means the visitor has signed in; an expired one just
// sends them through sign-in from the dashboard. Reading the cookie keeps the
// Supabase client out of the home page bundle.
export default function AccountLink() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(/(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/.test(document.cookie));
  }, []);

  return signedIn
    ? <Link href="/dashboard" className="hp-signin">Dashboard</Link>
    : <Link href="/sign-in" className="hp-signin">Sign in</Link>;
}
