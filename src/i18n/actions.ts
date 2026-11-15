"use server";

import { cookies } from "next/headers";
import { api } from "@/lib/api/server";
import { env } from "@/lib/env";
import { isEnabled, isLanguage } from "./languages";
import { LANGUAGE_COOKIE } from "./resolve";
import { localizedPath } from "./routing";

const SESSION_COOKIE = /^sb-[^=]+-auth-token(?:\.\d+)?$/;
const YEAR = 60 * 60 * 24 * 365;

/** The cookie that remembers the choice (FR-23.4): only the language code, read only by the server. */
export async function languageCookie(lang: string) {
  return { name: LANGUAGE_COOKIE, value: lang, maxAge: YEAR, path: "/", sameSite: "lax" as const, httpOnly: true, secure: env.siteUrl.startsWith("https://") };
}

/**
 * The language switcher (W7, FR-23.2–23.4): remembers the choice in a cookie and, when signed in,
 * on the profile (so it follows the user to other devices and to their emails). Answers where to go
 * next: the same public page in that language, or the same address for other pages. Only paths on
 * this site are accepted, so it can't be used to send someone elsewhere.
 */
export async function setLanguage(lang: string, currentPath: string): Promise<{ redirectTo: string } | { error: "unknown_language" }> {
  if (!isEnabled(lang)) return { error: "unknown_language" };
  const path = typeof currentPath === "string" && currentPath.startsWith("/") && !currentPath.startsWith("//") && !currentPath.includes("\\") ? currentPath.slice(0, 2048) : "/";

  const jar = await cookies();
  jar.set(await languageCookie(lang));

  const signedIn = jar.getAll().some((c) => SESSION_COOKIE.test(c.name) && c.value !== "");
  // The pseudo-language is a development tool and is never saved to a profile.
  if (signedIn && isLanguage(lang)) {
    try {
      await (await api()).PATCH("/v1/me", { body: { language: lang } });
    } catch (error) {
      // The cookie still works on this device; the profile catches up at the next sign-in.
      console.warn(`[i18n] couldn't save the language to the profile: ${(error as Error).message}`);
    }
  }
  const [pathname, query = ""] = path.split("?");
  return { redirectTo: localizedPath(pathname!, lang as Parameters<typeof localizedPath>[1]) + (query ? `?${query}` : "") };
}
