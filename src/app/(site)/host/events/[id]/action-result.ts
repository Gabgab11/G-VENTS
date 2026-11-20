import "server-only";

import { getTranslations } from "next-intl/server";
import { ApiError } from "@/lib/api/problem";

// Results of the workspace's dialog actions (Promote, Team, Activity, Announcements). They return to
// the client component that called them instead of redirecting, so a dialog can stay open and show
// its error. Errors are already in the reader's language: an API code's text from errors.json, or a
// generic message; never the API's raw text.

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; field?: string };

export const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });

export async function failure(messageId: string, field?: string): Promise<{ ok: false; error: string; field?: string }> {
  const t = await getTranslations("dashboard");
  return { ok: false, error: t(messageId), ...(field ? { field } : {}) };
}

/** An API error's text in the reader's language (the first field issue's code when there is one). */
export async function apiFailure(error: unknown, where: string): Promise<{ ok: false; error: string; field?: string }> {
  const errors = await getTranslations("errors");
  if (error instanceof ApiError) {
    const issue = error.problem.errors?.[0];
    for (const code of [issue?.code, error.code]) {
      if (code && /^[a-z_]+\.[a-z_]+$/.test(code) && errors.has(code)) return { ok: false, error: errors(code), ...(issue?.field ? { field: issue.field } : {}) };
    }
    if (error.status >= 500) console.error(`[host/events] ${where}: ${error.message}`);
  } else {
    console.error(`[host/events] ${where}`, error);
  }
  return failure("notices.err.failed");
}
